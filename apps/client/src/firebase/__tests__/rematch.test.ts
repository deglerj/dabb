import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

const setMock = vi.fn(() => Promise.resolve());
const ensureAuthenticatedMock = vi.fn(() => Promise.resolve({ uid: 'host-uid' }));

vi.mock('../config.js', () => ({ db: {} }));
vi.mock('../auth.js', () => ({ ensureAuthenticated: ensureAuthenticatedMock }));
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  set: setMock,
  onValue: vi.fn(),
  off: vi.fn(),
}));

const { claimRematchSeat, createRematchSession, publishRematchCode, sendRematchVote } =
  await import('../rematch.js');

const seats = [
  { playerIndex: 0 as PlayerIndex, nickname: 'Hans', isAI: false },
  { playerIndex: 1 as PlayerIndex, nickname: 'Klara', isAI: false },
  {
    playerIndex: 2 as PlayerIndex,
    nickname: 'Bot Fritz',
    isAI: true,
    aiDifficulty: 'hard' as const,
  },
];

describe('authenticated rematch transport', () => {
  beforeEach(() => {
    setMock.mockClear();
    ensureAuthenticatedMock.mockClear();
    localStorage.clear();
  });

  it('creates an active rematch with an authenticated host and delegated AI seats', async () => {
    const result = await createRematchSession(seats, 0 as PlayerIndex, 3, 1000, 'finished-room');

    expect(result.code).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    expect(ensureAuthenticatedMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^sessions\/.+\/meta$/) }),
      expect.objectContaining({
        status: 'active',
        rematchOf: 'finished-room',
        players: {
          '0': { nickname: 'Hans', ownerUid: 'host-uid', isAI: false },
          '2': { nickname: 'Bot Fritz', isAI: true, aiDifficulty: 'hard' },
        },
      })
    );
    const stored = JSON.parse(localStorage.getItem(`dabb-${result.code}`) ?? '{}') as {
      ownerUid?: string;
      playerIndex?: number;
    };
    expect(stored).toEqual({ ownerUid: 'host-uid', playerIndex: 0, playerCount: 3 });
    expect(stored).not.toHaveProperty('secretHash');
  });

  it('claims only the requested rematch seat with the current auth identity', async () => {
    await claimRematchSeat('rematch-room', 1 as PlayerIndex, 'Klara');

    expect(ensureAuthenticatedMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      { path: 'sessions/rematch-room/meta/players/1' },
      { nickname: 'Klara', ownerUid: 'host-uid', isAI: false }
    );
    expect(localStorage.getItem('dabb-rematch-room')).toBe(
      JSON.stringify({ ownerUid: 'host-uid', playerIndex: 1 })
    );
  });

  it('authenticates rematch votes and one-time code publication', async () => {
    await sendRematchVote('finished-room', 1 as PlayerIndex, true);
    await publishRematchCode('finished-room', 'rematch-room');

    expect(ensureAuthenticatedMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenNthCalledWith(
      1,
      { path: 'sessions/finished-room/rematch/votes/1' },
      true
    );
    expect(setMock).toHaveBeenNthCalledWith(
      2,
      { path: 'sessions/finished-room/rematch/code' },
      'rematch-room'
    );
  });
});
