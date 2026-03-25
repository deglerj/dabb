import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlayerIndex, GameState, Suit, Rank } from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';
import { BinokelAIPlayer } from '../ai/BinokelAIPlayer.js';

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
              nickname: '🤖 Hans',
              player_index: 1,
              team: null,
              connected: true,
              is_ai: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await addAIPlayer('session-1');

      expect(result.isAI).toBe(true);
      expect(result.nickname).toBe('🤖 Hans');
      expect(result.playerIndex).toBe(1);
      expect(result.secretId).toBeNull();
    });

    it('throws error when session not found', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Session not found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(addAIPlayer('nonexistent')).rejects.toThrow(GameError);
    });

    it('throws error when game already started', async () => {
      const { addAIPlayer } = await import('../services/sessionService.js');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ player_count: 2, status: 'active' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(addAIPlayer('session-1')).rejects.toThrow(GameError);
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

      await expect(addAIPlayer('session-1')).rejects.toThrow(GameError);
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
            { player_index: 1, nickname: '🤖 Hans' }, // Hans already taken
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ai-player-2',
              session_id: 'session-1',
              secret_id: null,
              nickname: '🤖 Greta', // Should pick Greta instead
              player_index: 2,
              team: null,
              connected: true,
              is_ai: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await addAIPlayer('session-1');

      expect(result.nickname).toBe('🤖 Greta');
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

describe('BinokelAIPlayer - 4-player team-aware bidding', () => {
  function makeBiddingState(overrides: Partial<GameState> = {}): GameState {
    const base: GameState = {
      phase: 'bidding',
      playerCount: 4,
      players: [
        { id: 'p0', nickname: 'Alice', playerIndex: 0, team: 0, connected: true },
        { id: 'p1', nickname: 'Bob', playerIndex: 1, team: 1, connected: true },
        { id: 'p2', nickname: 'Carol', playerIndex: 2, team: 0, connected: true },
        { id: 'p3', nickname: 'Dave', playerIndex: 3, team: 1, connected: true },
      ],
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, []],
        [3 as PlayerIndex, []],
      ]),
      dabb: [],
      currentBid: 160,
      bidWinner: null,
      currentBidder: 2 as PlayerIndex,
      firstBidder: 1 as PlayerIndex,
      passedPlayers: new Set(),
      lastBidderIndex: 0 as PlayerIndex, // Alice (team 0) set the current bid
      trump: null,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      tricksTaken: new Map(),
      currentPlayer: null,
      roundScores: new Map(),
      totalScores: new Map(),
      targetScore: 1000,
      declaredMelds: new Map(),
      dealer: 3 as PlayerIndex,
      round: 1,
      wentOut: false,
      dabbCardIds: [],
      lastCompletedTrick: null,
    };
    return { ...base, ...overrides };
  }

  // A weak hand: no melds, few low cards → estimatedTotal well below 160+60
  const weakHand = [
    { id: 'kreuz-buabe-1', suit: 'kreuz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'kreuz-ober-1', suit: 'kreuz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'schippe-buabe-1', suit: 'schippe' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'schippe-ober-1', suit: 'schippe' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'bollen-buabe-1', suit: 'bollen' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'bollen-ober-1', suit: 'bollen' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'bollen-koenig-1', suit: 'bollen' as Suit, rank: 'koenig' as Rank, copy: 0 as const },
  ];

  // A strong hand: Familie in Herz (100 pts melds) + lots of trump → diff well above 60
  const strongHand = [
    { id: 'herz-ass-1', suit: 'herz' as Suit, rank: 'ass' as Rank, copy: 0 as const },
    { id: 'herz-10-1', suit: 'herz' as Suit, rank: '10' as Rank, copy: 0 as const },
    { id: 'herz-koenig-1', suit: 'herz' as Suit, rank: 'koenig' as Rank, copy: 0 as const },
    { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'herz-ass-2', suit: 'herz' as Suit, rank: 'ass' as Rank, copy: 1 as const },
    { id: 'herz-10-2', suit: 'herz' as Suit, rank: '10' as Rank, copy: 1 as const },
    { id: 'herz-koenig-2', suit: 'herz' as Suit, rank: 'koenig' as Rank, copy: 1 as const },
    { id: 'herz-ober-2', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 1 as const },
  ];

  it('always passes against teammate when hand is weak (diff < 60)', async () => {
    const ai = new BinokelAIPlayer(0); // hard — no blunders
    const state = makeBiddingState({
      currentBid: 160,
      lastBidderIndex: 0 as PlayerIndex, // Alice = team 0 = Carol's teammate
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, weakHand],
        [3 as PlayerIndex, []],
      ]),
    });
    // Hard AI should always pass against teammate when diff < 60 (deterministic)
    for (let i = 0; i < 20; i++) {
      const action = await ai.decide({
        gameState: state,
        playerIndex: 2 as PlayerIndex,
        sessionId: 'test',
      });
      expect(action.type).toBe('pass');
    }
  });

  it('bids against teammate when hand is strong (diff >= 60)', async () => {
    const ai = new BinokelAIPlayer(0);
    const state = makeBiddingState({
      currentBid: 150,
      lastBidderIndex: 0 as PlayerIndex, // teammate
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, strongHand],
        [3 as PlayerIndex, []],
      ]),
    });
    const action = await ai.decide({
      gameState: state,
      playerIndex: 2 as PlayerIndex,
      sessionId: 'test',
    });
    expect(action.type).toBe('bid');
  });

  it('uses normal probabilistic logic when bidding against an opponent', async () => {
    const ai = new BinokelAIPlayer(0);
    const state = makeBiddingState({
      currentBid: 160,
      lastBidderIndex: 1 as PlayerIndex, // Bob = team 1 = opponent
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, weakHand],
        [3 as PlayerIndex, []],
      ]),
    });
    // With a weak hand vs opponent, probabilistic logic applies — just check no crash and valid type
    const action = await ai.decide({
      gameState: state,
      playerIndex: 2 as PlayerIndex,
      sessionId: 'test',
    });
    expect(['bid', 'pass']).toContain(action.type);
  });
});
