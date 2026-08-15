import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_NAMES } from '@dabb/shared-types';
import type { PlayerIndex } from '@dabb/shared-types';
import { renderHook, act } from '@testing-library/react';
import { useOfflineGame } from '../useOfflineGame.js';

// vi.mock is hoisted — use vi.hoisted() for variables referenced inside factory
const { mockDispatch, mockGetView, mockStart } = vi.hoisted(() => {
  const mockDispatch = vi.fn().mockResolvedValue(undefined);
  const mockGetView = vi.fn().mockReturnValue({
    state: {
      phase: 'bidding',
      playerCount: 2,
      players: [],
      hands: new Map(),
      dabb: [],
      currentBid: 0,
      bidWinner: null,
      currentBidder: 0,
      firstBidder: null,
      passedPlayers: new Set(),
      lastBidderIndex: null,
      trump: null,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      tricksTaken: new Map(),
      currentPlayer: null,
      roundScores: new Map(),
      totalScores: new Map(),
      targetScore: 1000,
      declaredMelds: new Map(),
      dealer: 0,
      round: 1,
      wentOut: false,
      dabbCardIds: [],
      lastCompletedTrick: null,
    },
    events: [],
  });
  const mockStart = vi.fn().mockResolvedValue(undefined);
  return { mockDispatch, mockGetView, mockStart };
});

// Vitest 4.x requires class keyword for constructor mocks
vi.mock('@dabb/game-ai', () => ({
  OfflineGameEngine: class {
    onStateChange = null;
    start = mockStart;
    dispatch = mockDispatch;
    getViewForPlayer = mockGetView;
    getPersistPayload = vi.fn().mockReturnValue({
      config: { playerCount: 2, difficulty: 'medium', humanPlayerIndex: 0 },
      events: [],
      phase: 'bidding',
    });
  },
}));

describe('useOfflineGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a GameInterface-compatible object', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('events');
    expect(result.current).toHaveProperty('replayedEventIds');
    expect(result.current).toHaveProperty('nicknames');
    expect(result.current).toHaveProperty('connected');
    expect(result.current).toHaveProperty('terminatedBy');
    expect(result.current).toHaveProperty('onBid');
    expect(result.current).toHaveProperty('onPass');
    expect(result.current).toHaveProperty('onExit');
  });

  it('connected is always true', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    expect(result.current.connected).toBe(true);
  });

  it('terminatedBy is always null', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    expect(result.current.terminatedBy).toBeNull();
  });

  it('nicknames contains human player name and AI names', async () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.nicknames.get(0)).toBe('Hans');
    // AI players get a name from the shared AI_NAMES list
    expect(AI_NAMES).toContain(result.current.nicknames.get(1));
  });

  // 'hans' is itself in AI_NAMES, so a player using it used to end up at a table with a
  // second Hans (regression).
  it('never gives an AI the human player name', async () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 4, difficulty: 'medium', nickname: 'hans', resume: false })
    );
    await act(async () => {
      await Promise.resolve();
    });

    const names = [1, 2, 3].map((i) => result.current.nicknames.get(i as PlayerIndex));
    expect(names).not.toContain('Hans');
    expect(new Set(names).size).toBe(3);
  });

  it('onBid calls engine.dispatch with bid action', async () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    await act(async () => {
      result.current.onBid(180);
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'bid', amount: 180 });
  });

  it('AI opponent names stay stable across re-renders (regression)', () => {
    const { result, rerender } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    const namesBefore = result.current.nicknames.get(1);
    rerender();
    const namesAfter = result.current.nicknames.get(1);
    expect(namesAfter).toBe(namesBefore);
  });

  it('onExit clears the saved game', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    await act(async () => {
      result.current.onExit();
    });

    expect(removeItem).toHaveBeenCalledWith('dabb-offline-game');
    removeItem.mockRestore();
  });
});
