import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';

// Mock the database pool
const mockQuery = vi.fn();
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
const mockConnect = vi.fn().mockResolvedValue(mockClient);

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

describe('AI Player Session Service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isHost', () => {
    it('returns true when player is host (playerIndex 0)', async () => {
      const { isHost } = await import('../services/sessionService.js');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'player-1',
            session_id: 'session-1',
            secret_id: 'secret-123',
            nickname: 'Host',
            player_index: 0,
            team: null,
            connected: true,
            is_ai: false,
          },
        ],
      });

      const result = await isHost('secret-123', 'session-1');

      expect(result).toBe(true);
    });

    it('returns false when player is not host', async () => {
      const { isHost } = await import('../services/sessionService.js');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'player-2',
            session_id: 'session-1',
            secret_id: 'secret-456',
            nickname: 'Player2',
            player_index: 1,
            team: null,
            connected: true,
            is_ai: false,
          },
        ],
      });

      const result = await isHost('secret-456', 'session-1');

      expect(result).toBe(false);
    });

    it('returns false when player not found', async () => {
      const { isHost } = await import('../services/sessionService.js');

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await isHost('invalid-secret', 'session-1');

      expect(result).toBe(false);
    });

    it('returns false when player belongs to different session', async () => {
      const { isHost } = await import('../services/sessionService.js');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'player-1',
            session_id: 'different-session',
            secret_id: 'secret-123',
            nickname: 'Host',
            player_index: 0,
            team: null,
            connected: true,
            is_ai: false,
          },
        ],
      });

      const result = await isHost('secret-123', 'session-1');

      expect(result).toBe(false);
    });
  });

  describe('addAIPlayer', () => {
    it('adds AI player with correct name prefix', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      // Session exists and is waiting
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ player_count: 2, status: 'waiting' }],
        })
        .mockResolvedValueOnce({
          rows: [{ player_index: 0, nickname: 'Host' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ai-player-1',
              session_id: 'session-1',
              secret_id: null,
              nickname: 'KI Hans',
              player_index: 1,
              team: null,
              connected: true,
              is_ai: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await addAIPlayer('session-1', 'KI');

      expect(result.isAI).toBe(true);
      expect(result.nickname).toBe('KI Hans');
      expect(result.playerIndex).toBe(1);
      expect(result.secretId).toBeNull();
    });

    it('throws error when session not found', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Session not found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(addAIPlayer('nonexistent', 'KI')).rejects.toThrow(GameError);
    });

    it('throws error when game already started', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ player_count: 2, status: 'active' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(addAIPlayer('session-1', 'KI')).rejects.toThrow(GameError);
    });

    it('throws error when no slots available', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ player_count: 2, status: 'waiting' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { player_index: 0, nickname: 'Player1' },
            { player_index: 1, nickname: 'Player2' },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(addAIPlayer('session-1', 'KI')).rejects.toThrow(GameError);
    });

    it('picks unique AI name not already in use', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ player_count: 3, status: 'waiting' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { player_index: 0, nickname: 'Host' },
            { player_index: 1, nickname: 'KI Hans' }, // Hans already taken
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ai-player-2',
              session_id: 'session-1',
              secret_id: null,
              nickname: 'KI Greta', // Should pick Greta instead
              player_index: 2,
              team: null,
              connected: true,
              is_ai: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await addAIPlayer('session-1', 'KI');

      expect(result.nickname).toBe('KI Greta');
    });
  });

  describe('removeAIPlayer', () => {
    it('removes AI player successfully', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'waiting' }] })
        .mockResolvedValueOnce({ rows: [{ is_ai: true }] })
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await expect(removeAIPlayer('session-1', 1 as PlayerIndex)).resolves.toBeUndefined();
    });

    it('throws error when session not found', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Session not found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(removeAIPlayer('nonexistent', 1 as PlayerIndex)).rejects.toThrow(GameError);
    });

    it('throws error when game already started', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(removeAIPlayer('session-1', 1 as PlayerIndex)).rejects.toThrow(GameError);
    });

    it('throws error when player is not AI', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'waiting' }] })
        .mockResolvedValueOnce({ rows: [{ is_ai: false }] }) // Human player
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(removeAIPlayer('session-1', 1 as PlayerIndex)).rejects.toThrow(GameError);
    });

    it('throws error when player not found', async () => {
      const { removeAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'waiting' }] })
        .mockResolvedValueOnce({ rows: [] }) // Player not found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(removeAIPlayer('session-1', 3 as PlayerIndex)).rejects.toThrow(GameError);
    });
  });
});
