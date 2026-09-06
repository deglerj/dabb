import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_ERROR_CODES, GameError } from '@dabb/shared-types';

const getMock = vi.fn();
const setMock = vi.fn();
const removeMock = vi.fn(() => Promise.resolve());

vi.mock('../config.js', () => ({ db: {} }));
vi.mock('../secretId.js', () => ({
  getOrCreateSecretId: vi.fn(() => Promise.resolve('secret')),
  hashSecretId: vi.fn(() => Promise.resolve('hash')),
}));
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  get: (...args: unknown[]) => getMock(...args),
  set: (...args: unknown[]) => setMock(...args),
  remove: (...args: unknown[]) => removeMock(...(args as [])),
  update: vi.fn(() => Promise.resolve()),
  onDisconnect: vi.fn(() => ({ set: vi.fn(), remove: vi.fn(() => Promise.resolve()) })),
  onValue: vi.fn(),
  off: vi.fn(),
}));

const { joinSession } = await import('../session.js');

function metaSnapshot(players: Record<string, unknown>, playerCount = 3) {
  return {
    exists: () => true,
    val: () => ({ playerCount, targetScore: 1000, status: 'waiting', createdAt: 0, players }),
  };
}

const HOST = { nickname: 'Hans', secretHash: 'other', isAI: false };
const RIVAL = { nickname: 'Klara', secretHash: 'rival', isAI: false };

describe('joinSession seat claiming', () => {
  beforeEach(() => {
    getMock.mockReset();
    setMock.mockReset();
    removeMock.mockClear();
  });

  it('takes the next seat when someone claimed the chosen one first (regression)', async () => {
    // Two players tap the same lobby row: both read the table with seat 1 free, and the
    // rules let exactly one of them write it. The loser must land on seat 2, not fail.
    getMock
      .mockResolvedValueOnce(metaSnapshot({ '0': HOST }))
      .mockResolvedValueOnce(metaSnapshot({ '0': HOST, '1': RIVAL }))
      .mockResolvedValueOnce(metaSnapshot({ '0': HOST, '1': RIVAL, '2': RIVAL }));
    setMock
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED: Permission denied'))
      .mockResolvedValue(undefined);

    const result = await joinSession('schnell-fuchs-42', 'Ute');

    expect(result.playerIndex).toBe(2);
    expect(setMock.mock.calls[0]?.[0]).toEqual({
      path: 'sessions/schnell-fuchs-42/meta/players/1',
    });
    expect(setMock.mock.calls[1]?.[0]).toEqual({
      path: 'sessions/schnell-fuchs-42/meta/players/2',
    });
  });

  it('reports a full table rather than retrying forever', async () => {
    getMock.mockResolvedValue(metaSnapshot({ '0': HOST, '1': RIVAL }, 2));

    await expect(joinSession('schnell-fuchs-42', 'Ute')).rejects.toThrow(
      new GameError(GAME_ERROR_CODES.SESSION_FULL)
    );
    expect(setMock).not.toHaveBeenCalled();
  });
});
