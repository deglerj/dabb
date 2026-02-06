import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

// Mock the session service
vi.mock('../services/sessionService.js', () => ({
  getSessionPlayers: vi.fn(),
}));

// Mock the game service
vi.mock('../services/gameService.js', () => ({
  getGameState: vi.fn(),
  placeBid: vi.fn(),
  passBid: vi.fn(),
  takeDabb: vi.fn(),
  discardCards: vi.fn(),
  goOut: vi.fn(),
  declareTrump: vi.fn(),
  declareMelds: vi.fn(),
  playCard: vi.fn(),
}));

// Mock the socket handlers
vi.mock('../socket/handlers.js', () => ({
  sessionSockets: new Map(),
}));

// Mock the AI player factory
vi.mock('../ai/index.js', () => ({
  defaultAIPlayerFactory: {
    create: vi.fn(() => ({
      decide: vi.fn().mockRejectedValue(new Error('AI decision logic not yet implemented')),
    })),
  },
}));

import { getSessionPlayers } from '../services/sessionService.js';

const mockedGetSessionPlayers = vi.mocked(getSessionPlayers);

describe('AI Controller Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerAIPlayer', () => {
    it('registers an AI player for a session', async () => {
      const { registerAIPlayer, isAIPlayer } = await import('../services/aiControllerService.js');

      registerAIPlayer('session-1', 1 as PlayerIndex);

      expect(isAIPlayer('session-1', 1 as PlayerIndex)).toBe(true);
      expect(isAIPlayer('session-1', 0 as PlayerIndex)).toBe(false);
    });

    it('can register multiple AI players', async () => {
      const { registerAIPlayer, isAIPlayer } = await import('../services/aiControllerService.js');

      registerAIPlayer('session-2', 1 as PlayerIndex);
      registerAIPlayer('session-2', 2 as PlayerIndex);

      expect(isAIPlayer('session-2', 1 as PlayerIndex)).toBe(true);
      expect(isAIPlayer('session-2', 2 as PlayerIndex)).toBe(true);
    });
  });

  describe('unregisterAIPlayer', () => {
    it('unregisters an AI player', async () => {
      const { registerAIPlayer, unregisterAIPlayer, isAIPlayer } =
        await import('../services/aiControllerService.js');

      registerAIPlayer('session-3', 1 as PlayerIndex);
      expect(isAIPlayer('session-3', 1 as PlayerIndex)).toBe(true);

      unregisterAIPlayer('session-3', 1 as PlayerIndex);
      expect(isAIPlayer('session-3', 1 as PlayerIndex)).toBe(false);
    });

    it('handles unregistering non-existent AI player gracefully', async () => {
      const { unregisterAIPlayer } = await import('../services/aiControllerService.js');

      // Should not throw
      expect(() => {
        unregisterAIPlayer('nonexistent-session', 1 as PlayerIndex);
      }).not.toThrow();
    });
  });

  describe('cleanupSession', () => {
    it('removes all AI players for a session', async () => {
      const { registerAIPlayer, cleanupSession, isAIPlayer } =
        await import('../services/aiControllerService.js');

      registerAIPlayer('session-4', 1 as PlayerIndex);
      registerAIPlayer('session-4', 2 as PlayerIndex);

      cleanupSession('session-4');

      expect(isAIPlayer('session-4', 1 as PlayerIndex)).toBe(false);
      expect(isAIPlayer('session-4', 2 as PlayerIndex)).toBe(false);
    });
  });

  describe('isAIPlayer', () => {
    it('returns false for non-existent session', async () => {
      const { isAIPlayer } = await import('../services/aiControllerService.js');

      expect(isAIPlayer('nonexistent', 0 as PlayerIndex)).toBe(false);
    });

    it('returns false for non-AI player index', async () => {
      const { registerAIPlayer, isAIPlayer } = await import('../services/aiControllerService.js');

      registerAIPlayer('session-5', 1 as PlayerIndex);

      expect(isAIPlayer('session-5', 0 as PlayerIndex)).toBe(false);
      expect(isAIPlayer('session-5', 2 as PlayerIndex)).toBe(false);
    });
  });

  describe('initializeAIPlayersFromSession', () => {
    it('registers AI players from session data', async () => {
      const { initializeAIPlayersFromSession, isAIPlayer, cleanupSession } =
        await import('../services/aiControllerService.js');

      // Clean up any previous state
      cleanupSession('session-6');

      mockedGetSessionPlayers.mockResolvedValueOnce([
        {
          id: 'player-1',
          sessionId: 'session-6',
          secretId: 'secret-1',
          nickname: 'Human',
          playerIndex: 0 as PlayerIndex,
          connected: true,
          isAI: false,
        },
        {
          id: 'player-2',
          sessionId: 'session-6',
          secretId: null,
          nickname: 'KI Hans',
          playerIndex: 1 as PlayerIndex,
          connected: true,
          isAI: true,
        },
      ]);

      await initializeAIPlayersFromSession('session-6');

      expect(isAIPlayer('session-6', 0 as PlayerIndex)).toBe(false);
      expect(isAIPlayer('session-6', 1 as PlayerIndex)).toBe(true);
    });

    it('handles session with no AI players', async () => {
      const { initializeAIPlayersFromSession, isAIPlayer, cleanupSession } =
        await import('../services/aiControllerService.js');

      cleanupSession('session-7');

      mockedGetSessionPlayers.mockResolvedValueOnce([
        {
          id: 'player-1',
          sessionId: 'session-7',
          secretId: 'secret-1',
          nickname: 'Human1',
          playerIndex: 0 as PlayerIndex,
          connected: true,
          isAI: false,
        },
        {
          id: 'player-2',
          sessionId: 'session-7',
          secretId: 'secret-2',
          nickname: 'Human2',
          playerIndex: 1 as PlayerIndex,
          connected: true,
          isAI: false,
        },
      ]);

      await initializeAIPlayersFromSession('session-7');

      expect(isAIPlayer('session-7', 0 as PlayerIndex)).toBe(false);
      expect(isAIPlayer('session-7', 1 as PlayerIndex)).toBe(false);
    });
  });
});
