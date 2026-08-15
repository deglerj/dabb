import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrickAnimationState } from '../useTrickAnimationState.js';
import type { CompletedTrick, GamePhase, Player, Trick } from '@dabb/shared-types';

// --- Test fixtures ---

const players: Player[] = [
  { id: 'p0', nickname: 'Alice', playerIndex: 0 },
  { id: 'p1', nickname: 'Bob', playerIndex: 1 },
  { id: 'p2', nickname: 'Carol', playerIndex: 2 },
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
  round: 1,
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
      useTrickAnimationState(emptyTrick, null, 'tricks', players, false)
    );
    expect(result.current.animPhase).toBe('idle');
    expect(result.current.displayCards).toHaveLength(0);
  });

  it('transitions to showing when currentTrick has cards', () => {
    const { result, rerender } = renderHook(
      ({ trick }) => useTrickAnimationState(trick, null, 'tricks', players, false),
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
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players, false),
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
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players, false),
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
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players, false),
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
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players, false),
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

    // Held for the 1s minimum first — the completed trick is still the one on the table
    expect(result.current.animPhase).toBe('paused');
    expect(result.current.displayCards).toHaveLength(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.animPhase).toBe('showing');
    expect(result.current.displayCards).toHaveLength(1);

    // Advance past original 3s — no transition to sweeping
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.animPhase).toBe('showing');
  });

  it('holds a completed trick for 1s even when the winner leads instantly (regression)', () => {
    const { result, rerender } = renderHook(
      ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players, false),
      { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
    );

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3 });
    });

    // Human winner clicks their next card straight away
    act(() => {
      rerender({ trick: trickWith1, completed: completedTrick3 });
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.animPhase).toBe('paused');
    expect(result.current.displayCards.map((c) => c.cardId)).toEqual([
      'card-a',
      'card-b',
      'card-c',
    ]);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.animPhase).toBe('showing');
    expect(result.current.displayCards.map((c) => c.cardId)).toEqual(['card-a']);
  });

  it('does not trigger pause for a replayed lastCompletedTrick', () => {
    // Reconnection: the replayed log carries a trick that finished before we got here. The
    // real client never has it on the very first render — state starts empty and the log
    // lands a tick later — so the guard has to name the trick as replayed, not "is this
    // render one".
    const { result, rerender } = renderHook(
      ({ initial }) =>
        useTrickAnimationState(emptyTrick, completedTrick3, 'tricks', players, initial),
      { initialProps: { initial: true } }
    );
    expect(result.current.animPhase).toBe('idle');

    // Log has settled; the same stale trick must still not animate (regression)
    act(() => {
      rerender({ initial: false });
    });
    expect(result.current.animPhase).toBe('idle');

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.animPhase).toBe('idle');
  });

  it('keeps the completed trick on screen when the round ends in the same update (regression)', () => {
    // The last trick of a round is one cascade — CARD_PLAYED, TRICK_WON, ROUND_SCORED — so a
    // single render carries the completed trick *and* a phase that has already left 'tricks'.
    // The showing effect used to win that race and wipe the table before it was ever painted.
    const { result, rerender } = renderHook(
      ({
        trick,
        completed,
        phase,
      }: {
        trick: Trick;
        completed: CompletedTrick | null;
        phase: GamePhase;
      }) => useTrickAnimationState(trick, completed, phase, players, false),
      {
        initialProps: {
          trick: trickWith3,
          completed: null as CompletedTrick | null,
          phase: 'tricks' as GamePhase,
        },
      }
    );
    expect(result.current.animPhase).toBe('showing');

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3, phase: 'scoring' as GamePhase });
    });

    expect(result.current.animPhase).toBe('paused');
    expect(result.current.displayCards).toHaveLength(3);
    expect(result.current.winnerIndex).toBe(1);

    // and it still runs the full pause -> sweep -> idle sequence
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.animPhase).toBe('sweeping');

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.animPhase).toBe('idle');
  });

  it('holds the next round back until the final sweep is done (regression)', () => {
    // The round-end cascade deals the next hand and opens bidding while the last trick is
    // still on the table, so the sweep used to play under a fresh hand and the bid dialog.
    const { result, rerender } = renderHook(
      ({
        trick,
        completed,
        phase,
      }: {
        trick: Trick;
        completed: CompletedTrick | null;
        phase: GamePhase;
      }) => useTrickAnimationState(trick, completed, phase, players, false),
      {
        initialProps: {
          trick: trickWith3,
          completed: null as CompletedTrick | null,
          phase: 'tricks' as GamePhase,
        },
      }
    );
    // Mid-round sweeps never hold anything back — the hand must stay visible.
    expect(result.current.holdsRoundStart).toBe(false);

    act(() => {
      rerender({ trick: emptyTrick, completed: completedTrick3, phase: 'bidding' as GamePhase });
    });
    expect(result.current.holdsRoundStart).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.holdsRoundStart).toBe(true);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.animPhase).toBe('idle');
    expect(result.current.holdsRoundStart).toBe(false);
  });

  it('returns idle when phase is not tricks', () => {
    const { result, rerender } = renderHook(
      ({ phase }: { phase: GamePhase }) =>
        useTrickAnimationState(trickWith3, null, phase, players, false),
      { initialProps: { phase: 'tricks' as GamePhase } }
    );

    expect(result.current.animPhase).toBe('showing');

    act(() => {
      rerender({ phase: 'scoring' });
    });

    expect(result.current.animPhase).toBe('idle');
  });
});
