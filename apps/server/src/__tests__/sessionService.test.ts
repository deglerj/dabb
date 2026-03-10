import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

// Shared mock state (must be declared before vi.mock calls)
const mockPoolQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}));

vi.mock('../utils/sessionCode.js', () => ({
  generateSessionCode: vi.fn().mockReturnValue('ABC123'),
}));

describe('sessionService', () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockReset();
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
  });

  describe('getSessionPlayers', () => {
    it('returns mapped players for a session', async () => {
      const { getSessionPlayers } = await import('../services/sessionService.js');

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            session_id: 's1',
            secret_id: 'sec1',
            nickname: 'Alice',
            player_index: 0,
            team: null,
            connected: true,
            is_ai: false,
            ai_difficulty: null,
          },
          {
            id: 'p2',
            session_id: 's1',
            secret_id: null,
            nickname: '🤖 Hans',
            player_index: 1,
            team: null,
            connected: true,
            is_ai: true,
            ai_difficulty: 'medium',
          },
        ],
      });

      const players = await getSessionPlayers('s1');

      expect(players).toHaveLength(2);
      expect(players[0]).toMatchObject({
        id: 'p1',
        sessionId: 's1',
        nickname: 'Alice',
        playerIndex: 0,
        isAI: false,
        aiDifficulty: undefined,
      });
      expect(players[1]).toMatchObject({
        id: 'p2',
        nickname: '🤖 Hans',
        isAI: true,
        aiDifficulty: 'medium',
      });
    });

    it('returns empty array when no players', async () => {
      const { getSessionPlayers } = await import('../services/sessionService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const players = await getSessionPlayers('s1');
      expect(players).toHaveLength(0);
    });
  });

  describe('updatePlayerConnection', () => {
    it('updates player connected status', async () => {
      const { updatePlayerConnection } = await import('../services/sessionService.js');
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

      await updatePlayerConnection('player-1', false);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'UPDATE players SET connected = $1 WHERE id = $2',
        [false, 'player-1']
      );
    });
  });

  describe('updateSessionStatus', () => {
    it('updates session status', async () => {
      const { updateSessionStatus } = await import('../services/sessionService.js');
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

      await updateSessionStatus('session-1', 'active');

      expect(mockPoolQuery).toHaveBeenCalledWith('UPDATE sessions SET status = $1 WHERE id = $2', [
        'active',
        'session-1',
      ]);
    });
  });

  describe('addAIPlayer', () => {
    it('adds an AI player to a session', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 3, status: 'waiting' }] }) // session check
        .mockResolvedValueOnce({ rows: [{ player_index: 0, nickname: 'Alice' }] }) // existing players
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ai-1',
              session_id: 's1',
              secret_id: null,
              nickname: '🤖 Hans',
              player_index: 1,
              team: null,
              connected: true,
              is_ai: true,
              ai_difficulty: 'medium',
            },
          ],
        }) // INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      const player = await addAIPlayer('s1', 'medium');

      expect(player).toMatchObject({
        id: 'ai-1',
        sessionId: 's1',
        isAI: true,
        aiDifficulty: 'medium',
      });
      expect(mockRelease).toHaveBeenCalled();
    });

    it('throws when session not found', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // session not found

      await expect(addAIPlayer('nonexistent', 'medium')).rejects.toThrow(GameError);
      expect(mockClientQuery).toHaveBeenCalledWith(expect.stringContaining('ROLLBACK'));
      expect(mockRelease).toHaveBeenCalled();
    });

    it('throws when game already started', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 3, status: 'active' }] }); // game started

      await expect(addAIPlayer('s1', 'medium')).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.CANNOT_ADD_AI_WHEN_GAME_STARTED,
      });
    });

    it('throws when session is full', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 2, status: 'waiting' }] }) // session
        .mockResolvedValueOnce({
          rows: [
            { player_index: 0, nickname: 'Alice' },
            { player_index: 1, nickname: 'Bob' },
          ],
        }); // already full

      await expect(addAIPlayer('s1', 'medium')).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.NO_AVAILABLE_SLOTS,
      });
    });
  });

  describe('createSession', () => {
    it('creates a session and host player', async () => {
      const { createSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // code uniqueness check (no conflict)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 's1',
              code: 'ABC123',
              player_count: 3,
              status: 'waiting',
              target_score: 1000,
              created_at: new Date('2024-01-01'),
            },
          ],
        }) // INSERT session
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'p1',
              session_id: 's1',
              secret_id: 'sec-1',
              nickname: 'Alice',
              player_index: 0,
              team: null,
              connected: true,
              is_ai: false,
            },
          ],
        }) // INSERT player
        .mockResolvedValueOnce(undefined); // COMMIT

      const { session, player } = await createSession(3, 1000, 'Alice');

      expect(session).toMatchObject({ id: 's1', code: 'ABC123', playerCount: 3 });
      expect(player).toMatchObject({ id: 'p1', nickname: 'Alice', playerIndex: 0 });
      expect(mockRelease).toHaveBeenCalled();
    });

    it('rollbacks on error', async () => {
      const { createSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // code check fails

      await expect(createSession(3, 1000, 'Alice')).rejects.toThrow('DB error');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('getSessionByCode', () => {
    it('returns session when found', async () => {
      const { getSessionByCode } = await import('../services/sessionService.js');

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            code: 'ABC123',
            player_count: 3,
            status: 'waiting',
            target_score: 1000,
            created_at: new Date('2024-01-01'),
          },
        ],
      });

      const session = await getSessionByCode('ABC123');

      expect(session).toMatchObject({ id: 's1', code: 'ABC123', playerCount: 3 });
    });

    it('returns null when not found', async () => {
      const { getSessionByCode } = await import('../services/sessionService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const session = await getSessionByCode('NOTFOUND');
      expect(session).toBeNull();
    });
  });

  describe('getSessionById', () => {
    it('returns session when found', async () => {
      const { getSessionById } = await import('../services/sessionService.js');

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            code: 'ABC123',
            player_count: 3,
            status: 'active',
            target_score: 1000,
            created_at: new Date('2024-01-01'),
          },
        ],
      });

      const session = await getSessionById('s1');
      expect(session).toMatchObject({ id: 's1', status: 'active' });
    });

    it('returns null when not found', async () => {
      const { getSessionById } = await import('../services/sessionService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const session = await getSessionById('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('joinSession', () => {
    it('adds a human player to a session', async () => {
      const { joinSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 3, status: 'waiting' }] }) // session check
        .mockResolvedValueOnce({ rows: [{ player_index: 0 }] }) // existing players
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'p2',
              session_id: 's1',
              secret_id: 'sec-2',
              nickname: 'Bob',
              player_index: 1,
              team: null,
              connected: true,
              is_ai: false,
            },
          ],
        }) // INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      const player = await joinSession('s1', 'Bob');

      expect(player).toMatchObject({ id: 'p2', nickname: 'Bob', playerIndex: 1 });
      expect(mockRelease).toHaveBeenCalled();
    });

    it('throws SESSION_NOT_FOUND when session does not exist', async () => {
      const { joinSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // session not found

      await expect(joinSession('nonexistent', 'Bob')).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.SESSION_NOT_FOUND,
      });
    });

    it('throws GAME_ALREADY_STARTED when not in waiting status', async () => {
      const { joinSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 3, status: 'active' }] });

      await expect(joinSession('s1', 'Bob')).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.GAME_ALREADY_STARTED,
      });
    });

    it('throws SESSION_FULL when session is at capacity', async () => {
      const { joinSession } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ player_count: 2, status: 'waiting' }] }) // session
        .mockResolvedValueOnce({
          rows: [{ player_index: 0 }, { player_index: 1 }],
        }); // already full

      await expect(joinSession('s1', 'Bob')).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.SESSION_FULL,
      });
    });
  });

  describe('removeAIPlayer', () => {
    it('removes an AI player from a session', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'waiting' }] }) // session check
        .mockResolvedValueOnce({ rows: [{ is_ai: true }] }) // player check
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE
        .mockResolvedValueOnce(undefined); // COMMIT

      await removeAIPlayer('s1', 1);

      expect(mockClientQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM players'), [
        's1',
        1,
      ]);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('throws when session not found', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // session not found

      await expect(removeAIPlayer('nonexistent', 1)).rejects.toThrow(GameError);
    });

    it('throws when game already started', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'active' }] }); // game started

      await expect(removeAIPlayer('s1', 1)).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.CANNOT_REMOVE_AI_WHEN_GAME_STARTED,
      });
    });

    it('throws when player is not an AI', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'waiting' }] }) // session
        .mockResolvedValueOnce({ rows: [{ is_ai: false }] }); // human player

      await expect(removeAIPlayer('s1', 0)).rejects.toMatchObject({
        code: SERVER_ERROR_CODES.PLAYER_NOT_AI,
      });
    });
  });
});
