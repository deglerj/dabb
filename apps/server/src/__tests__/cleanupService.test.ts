import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database pool
const mockQuery = vi.fn();
vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

describe('CleanupService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findInactiveSessions', () => {
    it('should find sessions with no recent activity', async () => {
      const { findInactiveSessions } = await import('../services/cleanupService.js');

      const mockSessions = [
        {
          id: 'session-1',
          code: 'ABC123',
          status: 'active',
          last_activity: new Date('2024-01-01'),
        },
        {
          id: 'session-2',
          code: 'DEF456',
          status: 'waiting',
          last_activity: new Date('2024-01-02'),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockSessions });

      const result = await findInactiveSessions(172800000); // 2 days

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT s.id, s.code, s.status'),
        expect.arrayContaining([expect.any(Date)])
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'session-1',
        code: 'ABC123',
        status: 'active',
        lastActivity: mockSessions[0].last_activity,
      });
      expect(result[1]).toEqual({
        id: 'session-2',
        code: 'DEF456',
        status: 'waiting',
        lastActivity: mockSessions[1].last_activity,
      });
    });

    it('should return empty array when no inactive sessions', async () => {
      const { findInactiveSessions } = await import('../services/cleanupService.js');

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findInactiveSessions(172800000);

      expect(result).toHaveLength(0);
    });

    it('should calculate cutoff time correctly', async () => {
      const { findInactiveSessions } = await import('../services/cleanupService.js');

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const thresholdMs = 86400000; // 1 day
      const before = Date.now() - thresholdMs;
      await findInactiveSessions(thresholdMs);
      const after = Date.now() - thresholdMs;

      const passedDate = mockQuery.mock.calls[0][1][0] as Date;
      expect(passedDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(passedDate.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('terminateSession', () => {
    it('should update session status to terminated', async () => {
      const { terminateSession } = await import('../services/cleanupService.js');

      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await terminateSession('session-123');

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE sessions SET status = 'terminated' WHERE id = $1",
        ['session-123']
      );
    });
  });
});
