import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockFindInactiveSessions = vi.fn();
const mockTerminateSession = vi.fn();
const mockClearGameStateCache = vi.fn();

vi.mock('../services/cleanupService.js', () => ({
  findInactiveSessions: (...args: unknown[]) => mockFindInactiveSessions(...args),
  terminateSession: (...args: unknown[]) => mockTerminateSession(...args),
}));

vi.mock('../services/gameService.js', () => ({
  clearGameStateCache: (...args: unknown[]) => mockClearGameStateCache(...args),
}));

// Create mock socket and sessionSockets map
const mockSocket = {
  emit: vi.fn(),
  disconnect: vi.fn(),
};

const mockSessionSockets = new Map<string, Set<typeof mockSocket>>();

vi.mock('../socket/handlers.js', () => ({
  sessionSockets: mockSessionSockets,
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  default: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock env
vi.mock('../config/env.js', () => ({
  env: {
    SESSION_CLEANUP_INTERVAL_MS: 3600000,
    SESSION_INACTIVITY_TIMEOUT_MS: 172800000,
  },
}));

describe('CleanupScheduler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mockFindInactiveSessions.mockReset();
    mockTerminateSession.mockReset();
    mockClearGameStateCache.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.disconnect.mockReset();
    mockSessionSockets.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('runCleanup', () => {
    it('should find and terminate inactive sessions', async () => {
      const { runCleanup } = await import('../scheduler/cleanupScheduler.js');

      const mockInactiveSessions = [
        { id: 'session-1', code: 'ABC123', status: 'active', lastActivity: new Date() },
        { id: 'session-2', code: 'DEF456', status: 'waiting', lastActivity: new Date() },
      ];

      mockFindInactiveSessions.mockResolvedValueOnce(mockInactiveSessions);
      mockTerminateSession.mockResolvedValue(undefined);

      const count = await runCleanup();

      expect(mockFindInactiveSessions).toHaveBeenCalledWith(172800000);
      expect(mockTerminateSession).toHaveBeenCalledTimes(2);
      expect(mockTerminateSession).toHaveBeenCalledWith('session-1');
      expect(mockTerminateSession).toHaveBeenCalledWith('session-2');
      expect(mockClearGameStateCache).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it('should return 0 when no inactive sessions found', async () => {
      const { runCleanup } = await import('../scheduler/cleanupScheduler.js');

      mockFindInactiveSessions.mockResolvedValueOnce([]);

      const count = await runCleanup();

      expect(mockTerminateSession).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should disconnect connected sockets and notify clients', async () => {
      const { runCleanup } = await import('../scheduler/cleanupScheduler.js');

      // Set up connected sockets for session-1
      const socketSet = new Set([mockSocket as unknown as typeof mockSocket]);
      mockSessionSockets.set('session-1', socketSet);

      mockFindInactiveSessions.mockResolvedValueOnce([
        { id: 'session-1', code: 'ABC123', status: 'active', lastActivity: new Date() },
      ]);
      mockTerminateSession.mockResolvedValue(undefined);

      await runCleanup();

      expect(mockSocket.emit).toHaveBeenCalledWith('session:terminated', {
        message: 'Session terminated due to inactivity',
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(mockSessionSockets.has('session-1')).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const { runCleanup } = await import('../scheduler/cleanupScheduler.js');

      mockFindInactiveSessions.mockRejectedValueOnce(new Error('Database error'));

      const count = await runCleanup();

      expect(count).toBe(0);
    });
  });

  describe('startCleanupScheduler', () => {
    it('should run cleanup immediately on startup', async () => {
      const { startCleanupScheduler, stopCleanupScheduler } =
        await import('../scheduler/cleanupScheduler.js');

      mockFindInactiveSessions.mockResolvedValue([]);

      const mockIo = {} as Parameters<typeof startCleanupScheduler>[0];
      startCleanupScheduler(mockIo);

      // Wait for the immediate async call to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFindInactiveSessions).toHaveBeenCalled();

      stopCleanupScheduler();
    });

    it('should schedule periodic cleanup', async () => {
      const { startCleanupScheduler, stopCleanupScheduler } =
        await import('../scheduler/cleanupScheduler.js');

      mockFindInactiveSessions.mockResolvedValue([]);

      const mockIo = {} as Parameters<typeof startCleanupScheduler>[0];
      startCleanupScheduler(mockIo);

      // Wait for the initial async call
      await Promise.resolve();
      await Promise.resolve();
      mockFindInactiveSessions.mockClear();

      // Advance by the interval (1 hour = 3600000ms)
      vi.advanceTimersByTime(3600000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFindInactiveSessions).toHaveBeenCalledTimes(1);

      // Advance by another interval
      vi.advanceTimersByTime(3600000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFindInactiveSessions).toHaveBeenCalledTimes(2);

      stopCleanupScheduler();
    });
  });

  describe('stopCleanupScheduler', () => {
    it('should stop the scheduled cleanup', async () => {
      const { startCleanupScheduler, stopCleanupScheduler } =
        await import('../scheduler/cleanupScheduler.js');

      mockFindInactiveSessions.mockResolvedValue([]);

      const mockIo = {} as Parameters<typeof startCleanupScheduler>[0];
      startCleanupScheduler(mockIo);

      // Wait for initial run to complete
      await Promise.resolve();
      await Promise.resolve();
      mockFindInactiveSessions.mockClear();

      // Stop scheduler
      stopCleanupScheduler();

      // Advance time - should not trigger cleanup
      vi.advanceTimersByTime(3600000);
      await Promise.resolve();

      expect(mockFindInactiveSessions).not.toHaveBeenCalled();
    });
  });
});
