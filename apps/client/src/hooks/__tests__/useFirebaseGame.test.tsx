import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

const subscriptions = {
  players: vi.fn(),
  presence: vi.fn(),
  status: vi.fn(),
  events: vi.fn(),
  emotes: vi.fn(),
};
const cleanups = {
  players: vi.fn(),
  setupPresence: vi.fn(),
  presence: vi.fn(),
  status: vi.fn(),
  events: vi.fn(),
  emotes: vi.fn(),
};
let playerCallback: ((players: Record<string, unknown>) => void) | undefined;
let eventCallback: ((event: unknown) => void) | undefined;
const processEvents = vi.fn(() => ({ status: 'applied', events: [], state: {}, newlyApplied: [] }));
const replaceEvents = vi.fn(() => ({ status: 'applied', events: [], state: {}, newlyApplied: [] }));
const emoteResult = { visible: new Map(), post: vi.fn(), merge: vi.fn() };

vi.mock('@dabb/ui-shared', () => ({
  useGameState: () => ({
    state: {},
    fullState: {},
    events: [],
    rawEvents: [],
    processEvents,
    replaceEvents,
  }),
}));
vi.mock('../useEmotes.js', () => ({ useEmotes: () => emoteResult }));
vi.mock('../useAIEmotes.js', () => ({ useAIEmotes: vi.fn() }));
vi.mock('../../firebase/config.js', () => ({ db: {} }));
vi.mock('../../firebase/secretId.js', () => ({
  hashSecretId: vi.fn(() => Promise.resolve('hash')),
}));
vi.mock('../../firebase/events.js', () => ({
  getAllEvents: vi.fn(() => Promise.resolve([])),
  pushEvents: vi.fn(),
  subscribeToEvents: vi.fn((_code: string, callback: (event: unknown) => void) => {
    eventCallback = callback;
    return cleanups.events;
  }),
}));
vi.mock('../../firebase/emotes.js', () => ({
  sendEmote: vi.fn(),
  subscribeToEmotes: vi.fn((_code: string, _callback: unknown) => {
    subscriptions.emotes();
    return cleanups.emotes;
  }),
}));
vi.mock('../../firebase/session.js', () => ({
  setupPresence: vi.fn(() => cleanups.setupPresence),
  subscribeToPlayers: vi.fn(
    (_code: string, callback: (players: Record<string, unknown>) => void) => {
      playerCallback = callback;
      subscriptions.players(_code);
      return cleanups.players;
    }
  ),
  subscribeToPresence: vi.fn(() => {
    subscriptions.presence();
    return cleanups.presence;
  }),
  subscribeToSessionStatus: vi.fn((_code: string, _callback: (status: string) => void) => {
    subscriptions.status();
    return cleanups.status;
  }),
}));

const { useFirebaseGame } = await import('../useFirebaseGame.js');

const options = { sessionCode: 'old', playerIndex: 0 as PlayerIndex };
const players = (nickname: string) => ({ '0': { nickname, isAI: false, secretHash: null } });

beforeEach(() => {
  vi.clearAllMocks();
  playerCallback = undefined;
  eventCallback = undefined;
});

describe('useFirebaseGame subscription lifecycle', () => {
  it('keeps subscriptions stable while metadata changes and resolves termination with latest names', async () => {
    const { result } = renderHook(() => useFirebaseGame(options));
    await act(async () => {
      await Promise.resolve();
      playerCallback?.(players('Old name'));
    });
    expect(result.current.players[0]?.nickname).toBe('Old name');
    await act(async () => {
      playerCallback?.(players('Current name'));
    });
    expect(result.current.players[0]?.nickname).toBe('Current name');
    await act(async () => {
      eventCallback?.({
        id: 'termination',
        sequence: 1,
        timestamp: 1,
        type: 'GAME_TERMINATED',
        payload: { terminatedBy: 0, reason: 'player_exit' },
      });
    });

    expect(result.current.terminatedBy).toEqual({ nickname: 'Current name' });
    expect(subscriptions.players).toHaveBeenCalledTimes(1);
    expect(subscriptions.presence).toHaveBeenCalledTimes(1);
    expect(subscriptions.status).toHaveBeenCalledTimes(1);
    expect(subscriptions.emotes).toHaveBeenCalledTimes(1);
  });

  it('cleans up old subscriptions before subscribing to a changed session', async () => {
    const { rerender } = renderHook((props) => useFirebaseGame(props), { initialProps: options });
    await act(async () => {
      await Promise.resolve();
      rerender({ ...options, sessionCode: 'new' });
    });

    expect(subscriptions.players).toHaveBeenLastCalledWith('new');
    expect(cleanups.players).toHaveBeenCalled();
    expect(cleanups.setupPresence).toHaveBeenCalled();
    expect(cleanups.presence).toHaveBeenCalled();
    expect(cleanups.status).toHaveBeenCalled();
    expect(cleanups.events).toHaveBeenCalled();
    expect(cleanups.emotes).toHaveBeenCalled();
  });

  it('survives absent metadata without affecting the event subscription', async () => {
    const { result } = renderHook(() => useFirebaseGame(options));
    await act(async () => {
      await Promise.resolve();
      playerCallback?.({});
    });

    expect(result.current.players).toEqual([]);
    expect(result.current.connected).toBe(true);
  });

  it('cleans up Strict Mode effect probes without leaving duplicate subscriptions', async () => {
    const { unmount } = renderHook(() => useFirebaseGame(options), {
      wrapper: StrictMode,
    });
    await act(async () => {
      await Promise.resolve();
    });
    unmount();

    expect(subscriptions.players).toHaveBeenCalledTimes(2);
    expect(subscriptions.presence).toHaveBeenCalledTimes(2);
    expect(subscriptions.status).toHaveBeenCalledTimes(2);
    expect(subscriptions.emotes).toHaveBeenCalledTimes(2);
    expect(cleanups.players).toHaveBeenCalledTimes(2);
    expect(cleanups.setupPresence).toHaveBeenCalledTimes(2);
    expect(cleanups.presence).toHaveBeenCalledTimes(2);
    expect(cleanups.status).toHaveBeenCalledTimes(2);
    expect(cleanups.emotes).toHaveBeenCalledTimes(2);
    expect(cleanups.events).toHaveBeenCalledTimes(1);
  });
});
