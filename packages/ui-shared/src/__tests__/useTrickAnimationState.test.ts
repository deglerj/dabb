import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrickAnimationState } from '../useTrickAnimationState.js';
import type { CompletedTrick, Player, Trick } from '@dabb/shared-types';

// --- Test fixtures ---

const players: Player[] = [
  { id: 'p0', nickname: 'Alice', playerIndex: 0, connected: true },
  { id: 'p1', nickname: 'Bob', playerIndex: 1, connected: true },
  { id: 'p2', nickname: 'Carol', playerIndex: 2, connected: true },
];

const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

const pc = (cardId: string, playerIndex: 0 | 1 | 2 | 3) => ({
  cardId,
  card: { id: cardId, suit: 'kreuz' as const, rank: 'ass' as const, copy: 0 as const },
  playerIndex,
});

const trickWith1: Trick = {
  cards: [pc('card-a', 0)],
  leadSuit: 'kreuz',
  winnerIndex: null,
};
const trickWith3: Trick = {
  cards: [pc('card-a', 0), pc('card-b', 1), pc('card-c', 2)],
  leadSuit: 'kreuz',
  winnerIndex: null,
};

const completedTrick3: CompletedTrick = {
  cards: [pc('card-a', 0), pc('card-b', 1), pc('card-c', 2)],
  winnerIndex: 1,
  points: 20,
};

// --- Tests ---

describe('useTrickAnimationState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('starts in idle with no cards', () => {
    const { result } = renderHook(() =>
      useTrickAnimationState(emptyTrick, null, 'tricks', players)
    );
    expect(result.current.animPhase).toBe('idle');
    expect(result.current.displayCards).toHaveLength(0);
  });

  it('transitions to showing when currentTrick has cards', () => {
    const { result, rerender } = renderHook(
      ({ trick }) => useTrickAnimationState(trick, null, 'tricks', players),
      { initialProps: { trick: emptyTrick } }
    );

    act(() => {
      rerender({ trick: trickWith1 });
    });

    expect(result.current.animPhase).toBe('showing');
    expect(result.current.displayCards).toHaveLength(1);
  });

  it('transitions to paused when a trick is completed, shows completed cards', () => {
    const { result, rerender } = renderHook(
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
      { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
    );

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3 });
    });

    expect(result.current.animPhase).toBe('paused');
    expect(result.current.displayCards).toHaveLength(3);
    expect(result.current.winnerIndex).toBe(1);
    expect(result.current.winnerPlayerId).toBe('p1');
  });

  it('transitions to sweeping after 3s pause, then idle after sweep completes', () => {
    const { result, rerender } = renderHook(
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
      { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
    );

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3 });
    });
    expect(result.current.animPhase).toBe('paused');

    // Advance past 3s pause
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.animPhase).toBe('sweeping');
    expect(result.current.sweepingCardCount).toBe(0);

    // After sweep completes (3 cards: 2*200 + 400 = 800ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.animPhase).toBe('idle');
    expect(result.current.displayCards).toHaveLength(0);
  });

  it('staggers sweepingCardCount during sweeping phase', () => {
    const { result, rerender } = renderHook(
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
      { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
    );

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3 });
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.sweepingCardCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.sweepingCardCount).toBe(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.sweepingCardCount).toBe(2);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.sweepingCardCount).toBe(3);
  });

  it('cancels pause early when a new card is played during pause', () => {
    const { result, rerender } = renderHook(
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
      { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
    );

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3 });
    });
    expect(result.current.animPhase).toBe('paused');

    // New card played before 3s
    act(() => {
      rerender({ trick: trickWith1, completed: completedTrick3 });
    });

    expect(result.current.animPhase).toBe('showing');
    expect(result.current.displayCards).toHaveLength(1);

    // Advance past original 3s — no transition to sweeping
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.animPhase).toBe('showing');
  });

  it('does not trigger pause on initial load with stale lastCompletedTrick', () => {
    // Simulate reconnection: lastCompletedTrick is already set at mount
    const { result } = renderHook(() =>
      useTrickAnimationState(emptyTrick, completedTrick3, 'tricks', players)
    );
    expect(result.current.animPhase).toBe('idle');
  });

  it('returns idle when phase is not tricks', () => {
    const { result, rerender } = renderHook(
      ({ phase }) => useTrickAnimationState(trickWith3, null, phase, players),
      { initialProps: { phase: 'tricks' as const } }
    );

    expect(result.current.animPhase).toBe('showing');

    act(() => {
      rerender({ phase: 'scoring' });
    });

    expect(result.current.animPhase).toBe('idle');
  });
});
