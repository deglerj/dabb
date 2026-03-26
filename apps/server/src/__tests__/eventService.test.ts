import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameEvent } from '@dabb/shared-types';

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

const baseEvent: GameEvent = {
  id: 'event-1',
  sessionId: 'session-1',
  sequence: 1,
  type: 'GAME_STARTED',
  payload: { playerCount: 3, targetScore: 1000, dealer: 0 },
  timestamp: 1700000000000,
};

describe('eventService', () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockReset();
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
  });

  describe('saveEvent', () => {
    it('inserts a single event into the database', async () => {
      const { saveEvent } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await saveEvent(baseEvent);

      expect(mockPoolQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockPoolQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO events');
      expect(params).toEqual([
        baseEvent.id,
        baseEvent.sessionId,
        baseEvent.sequence,
        baseEvent.type,
        baseEvent.payload,
      ]);
    });
  });

  describe('saveEvents', () => {
    it('does nothing when given an empty array', async () => {
      const { saveEvents } = await import('../services/eventService.js');

      await saveEvents([]);

      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('wraps multiple events in a transaction', async () => {
      const { saveEvents } = await import('../services/eventService.js');
      mockClientQuery.mockResolvedValue({ rows: [] });

      const event2: GameEvent = { ...baseEvent, id: 'event-2', sequence: 2 };
      await saveEvents([baseEvent, event2]);

      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalledOnce();

      const insertCalls = mockClientQuery.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('INSERT INTO events')
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('rolls back and re-throws on error', async () => {
      const { saveEvents } = await import('../services/eventService.js');
      const dbError = new Error('DB failure');
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockRejectedValueOnce(dbError); // first INSERT

      await expect(saveEvents([baseEvent])).rejects.toThrow('DB failure');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });

  describe('getEvents', () => {
    it('returns mapped events ordered by sequence', async () => {
      const { getEvents } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            session_id: 'session-1',
            sequence: '1',
            event_type: 'GAME_STARTED',
            payload: { playerCount: 3 },
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const events = await getEvents('session-1');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: 'event-1',
        sessionId: 'session-1',
        sequence: 1,
        type: 'GAME_STARTED',
      });
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('uses afterSequence = 0 by default', async () => {
      const { getEvents } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await getEvents('session-1');

      const [, params] = mockPoolQuery.mock.calls[0];
      expect(params).toEqual(['session-1', 0]);
    });

    it('passes custom afterSequence to query', async () => {
      const { getEvents } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await getEvents('session-1', 5);

      const [, params] = mockPoolQuery.mock.calls[0];
      expect(params).toEqual(['session-1', 5]);
    });
  });

  describe('getAllEvents', () => {
    it('queries with afterSequence = -1 to include all events', async () => {
      const { getAllEvents } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await getAllEvents('session-1');

      const [, params] = mockPoolQuery.mock.calls[0];
      expect(params).toEqual(['session-1', -1]);
    });
  });

  describe('getLastSequence', () => {
    it('returns the maximum sequence number', async () => {
      const { getLastSequence } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ max_seq: '42' }] });

      const seq = await getLastSequence('session-1');

      expect(seq).toBe(42);
    });

    it('returns 0 when no events exist (COALESCE result)', async () => {
      const { getLastSequence } = await import('../services/eventService.js');
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ max_seq: '0' }] });

      const seq = await getLastSequence('session-1');

      expect(seq).toBe(0);
    });
  });
});
