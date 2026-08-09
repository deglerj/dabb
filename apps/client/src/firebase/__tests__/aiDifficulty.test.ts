import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerCount } from '@dabb/shared-types';

const setMock = vi.fn(async (_path: string, _value: unknown) => undefined);

vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ path }),
  set: (r: { path: string }, value: unknown) => setMock(r.path, value),
  get: vi.fn(),
  update: vi.fn(),
  onDisconnect: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
}));

vi.mock('../config.js', () => ({ db: {} }));

const { addAIPlayer } = await import('../session.js');

describe('addAIPlayer', () => {
  beforeEach(() => {
    setMock.mockClear();
  });

  // The waiting room has always let the host pick a difficulty per AI, but the choice was
  // dropped on the floor here: the player record was written without it, nothing read it
  // back, and useAI called createAIPlayer() with no argument — so every online bot played
  // at medium regardless of what the host selected.
  it('stores the chosen difficulty on the AI player record (regression)', async () => {
    await addAIPlayer('adjective-noun-7', {}, 3 as PlayerCount, 'Bot Fritz', 'hard');

    expect(setMock).toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/0',
      expect.objectContaining({ nickname: 'Bot Fritz', isAI: true, aiDifficulty: 'hard' })
    );
  });

  it('keeps each AI seat on its own difficulty', async () => {
    await addAIPlayer(
      'adjective-noun-7',
      { '0': { nickname: 'Alice', secretHash: 'h', isAI: false } },
      3 as PlayerCount,
      'Bot Hilde',
      'easy'
    );

    expect(setMock).toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/1',
      expect.objectContaining({ aiDifficulty: 'easy' })
    );
  });

  it('fills the lowest free seat', async () => {
    await addAIPlayer(
      'adjective-noun-7',
      {
        '0': { nickname: 'Alice', secretHash: 'h', isAI: false },
        '2': { nickname: 'Bot Klaus', secretHash: null, isAI: true, aiDifficulty: 'medium' },
      },
      3 as PlayerCount,
      'Bot Liesel',
      'medium'
    );

    expect(setMock).toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/1',
      expect.objectContaining({ nickname: 'Bot Liesel' })
    );
  });

  it('rejects when every seat is taken', async () => {
    await expect(
      addAIPlayer(
        'adjective-noun-7',
        {
          '0': { nickname: 'Alice', secretHash: 'h', isAI: false },
          '1': { nickname: 'Bob', secretHash: 'h', isAI: false },
        },
        2 as PlayerCount,
        'Bot Fritz',
        'medium'
      )
    ).rejects.toThrow('SESSION_FULL');
  });
});
