import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_NAMES, availableAINames } from '@dabb/shared-types';
import type { SessionMeta } from '../session.js';

const setMock = vi.fn(async (_path: string, _value: unknown) => undefined);
let meta: SessionMeta;

vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ path }),
  set: (r: { path: string }, value: unknown) => setMock(r.path, value),
  get: async () => ({ exists: () => true, val: () => meta }),
  remove: vi.fn(),
  update: vi.fn(),
  onDisconnect: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
}));

vi.mock('../config.js', () => ({ db: {} }));
vi.mock('../secretId.js', () => ({
  getOrCreateSecretId: async () => 'secret',
  hashSecretId: async () => 'hash',
}));

const { joinSession } = await import('../session.js');

describe('availableAINames', () => {
  it('drops names a player at the table already uses', () => {
    expect(availableAINames(['Hans'])).not.toContain('Hans');
    expect(availableAINames(['Hans'])).toContain('Greta');
  });

  it('matches nicknames trimmed and case-insensitively', () => {
    expect(availableAINames([' hAnS '])).not.toContain('Hans');
  });

  it('leaves the list untouched when nothing collides', () => {
    expect(availableAINames(['Johannes'])).toEqual([...AI_NAMES]);
  });
});

describe('joinSession', () => {
  beforeEach(() => {
    setMock.mockClear();
  });

  // A bot's name was picked when it was added, so a human joining later could type the same one
  // and the table showed two "Hans". The human keeps their name; the bot is renamed (regression).
  it('renames an AI whose nickname the joining human took (regression)', async () => {
    meta = {
      playerCount: 3,
      targetScore: 1000,
      status: 'waiting',
      createdAt: 0,
      players: {
        '0': { nickname: 'Alice', secretHash: 'h', isAI: false },
        '1': { nickname: 'Hans', secretHash: null, isAI: true, aiDifficulty: 'medium' },
      },
    };

    await joinSession('adjective-noun-7', 'hans');

    expect(setMock).toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/2',
      expect.objectContaining({ nickname: 'hans', isAI: false })
    );
    expect(setMock).toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/1/nickname',
      'Greta'
    );
  });

  it('leaves AI names alone when the human picks something else', async () => {
    meta = {
      playerCount: 3,
      targetScore: 1000,
      status: 'waiting',
      createdAt: 0,
      players: {
        '0': { nickname: 'Alice', secretHash: 'h', isAI: false },
        '1': { nickname: 'Hans', secretHash: null, isAI: true, aiDifficulty: 'medium' },
      },
    };

    await joinSession('adjective-noun-7', 'Johannes');

    expect(setMock).not.toHaveBeenCalledWith(
      'sessions/adjective-noun-7/meta/players/1/nickname',
      expect.anything()
    );
  });
});
