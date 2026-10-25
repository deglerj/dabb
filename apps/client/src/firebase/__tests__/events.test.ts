import { describe, expect, it, vi } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

const updateMock = vi.fn(() => Promise.resolve());
const pushMock = vi.fn(() => ({ key: 'event-key' }));
const runTransactionMock = vi.fn();

vi.mock('../config.js', () => ({ db: {} }));
vi.mock('../auth.js', () => ({
  ensureAuthenticated: vi.fn(() => Promise.resolve({ uid: 'member' })),
}));
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: pushMock,
  update: updateMock,
  runTransaction: runTransactionMock,
  onChildAdded: vi.fn(),
  off: vi.fn(),
  get: vi.fn(),
}));

const { claimCascade, pushEvents } = await import('../events.js');

const event = {
  id: 'event-1',
  sessionId: 'room',
  sequence: 1,
  timestamp: 1,
  actor: 0 as PlayerIndex,
  type: 'BID_PLACED' as const,
  payload: { playerIndex: 0 as PlayerIndex, amount: 150 },
};

describe('authenticated event transport', () => {
  it('writes the actor-bearing event without a bearer authorization field', async () => {
    await pushEvents('room', [event]);

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'sessions/room/events/event-key': event,
      })
    );
    const written = (updateMock.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(written['sessions/room/events/event-key']).not.toHaveProperty('authorHash');
  });

  it('returns true only for the authenticated winner of the atomic AI claim', async () => {
    runTransactionMock.mockImplementationOnce(async (_ref, updateFn) => {
      const value = updateFn(null);
      return {
        committed: true,
        snapshot: { val: () => value },
      };
    });

    await expect(claimCascade('room', 'turn-1', 2 as PlayerIndex)).resolves.toBe(true);
    expect(runTransactionMock).toHaveBeenCalledOnce();
    expect(runTransactionMock.mock.calls[0]?.[1](null)).toMatchObject({
      playerIndex: 2,
      claimedBy: 'member',
    });
  });
});
