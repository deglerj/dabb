import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionRequired, useActionRequiredCallback } from '../useActionRequired.js';
import type { GameState, PlayerIndex } from '@dabb/shared-types';

function makeState(overrides: Partial<GameState>): GameState {
  return {
    phase: 'bidding',
    playerCount: 3,
    currentBidder: 0,
    currentPlayer: 0,
    bidWinner: null,
    dabb: [],
    hands: new Map(),
    declaredMelds: new Map(),
    tricks: [],
    scores: {},
    wentOut: false,
    trump: null,
    ...overrides,
  } as unknown as GameState;
}

describe('useActionRequired', () => {
  it('requires no action when state is null', () => {
    const { result } = renderHook(() => useActionRequired(null, 0 as PlayerIndex));
    expect(result.current).toBe(false);
  });

  it('requires no action when playerIndex is null', () => {
    const state = makeState({ phase: 'bidding', currentBidder: 0 });
    const { result } = renderHook(() => useActionRequired(state, null));
    expect(result.current).toBe(false);
  });

  describe('bidding phase', () => {
    it('requires action when it is the current player turn', () => {
      const state = makeState({ phase: 'bidding', currentBidder: 1 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action when it is another player turn', () => {
      const state = makeState({ phase: 'bidding', currentBidder: 0 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(false);
    });
  });

  describe('dabb phase', () => {
    it('requires action from the bid winner', () => {
      const state = makeState({
        phase: 'dabb',
        bidWinner: 0,
        dabb: [
          { id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 },
          { id: 'herz-10-0', suit: 'herz', rank: '10', copy: 0 },
        ],
      });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action from a non-bid-winner', () => {
      const state = makeState({ phase: 'dabb', bidWinner: 0, dabb: [] });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(false);
    });
  });

  describe('trump phase', () => {
    it('requires action from the bid winner', () => {
      const state = makeState({ phase: 'trump', bidWinner: 2 });
      const { result } = renderHook(() => useActionRequired(state, 2 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action from a non-bid-winner', () => {
      const state = makeState({ phase: 'trump', bidWinner: 0 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(false);
    });
  });

  describe('discard phase', () => {
    // The phase order became dabb -> trump -> discard, but this hook kept its own copy of
    // the turn rules and never grew a 'discard' case, so the bid winner got no turn
    // indicator while laying away.
    it('requires action from the bid winner during the layaway (regression)', () => {
      const state = makeState({ phase: 'discard', bidWinner: 1, trump: 'herz' });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action from a non-bid-winner', () => {
      const state = makeState({ phase: 'discard', bidWinner: 1, trump: 'herz' });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(false);
    });
  });

  describe('melding phase', () => {
    it('requires action when the player has not yet declared', () => {
      const state = makeState({ phase: 'melding', declaredMelds: new Map() });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action once the player has declared', () => {
      const declaredMelds = new Map([[0 as PlayerIndex, [] as never[]]]);
      const state = makeState({ phase: 'melding', declaredMelds });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(false);
    });

    // Melding is simultaneous — nothing sequences the players. Prompting only the lowest
    // undeclared seat would leave everyone behind them without a turn indicator.
    it('prompts every undeclared player at once, not just the first (regression)', () => {
      const state = makeState({ phase: 'melding', declaredMelds: new Map() });
      const { result } = renderHook(() => useActionRequired(state, 2 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('never prompts a bid winner who went out (regression)', () => {
      const state = makeState({
        phase: 'melding',
        declaredMelds: new Map(),
        wentOut: true,
        bidWinner: 0 as PlayerIndex,
      });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(false);
    });

    it('still prompts the other players when the bid winner went out', () => {
      const state = makeState({
        phase: 'melding',
        declaredMelds: new Map(),
        wentOut: true,
        bidWinner: 0 as PlayerIndex,
      });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toBe(true);
    });
  });

  describe('tricks phase', () => {
    it('requires action when it is the current player turn', () => {
      const state = makeState({ phase: 'tricks', currentPlayer: 0 });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(true);
    });

    it('requires no action when it is another player turn', () => {
      const state = makeState({ phase: 'tricks', currentPlayer: 1 });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toBe(false);
    });
  });

  it('requires no action in finished phase', () => {
    const state = makeState({ phase: 'finished' });
    const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
    expect(result.current).toBe(false);
  });
});

describe('useActionRequiredCallback', () => {
  it('does not call callback on initial render even when action is required', () => {
    const callback = vi.fn();
    const state = makeState({ phase: 'bidding', currentBidder: 0 });
    renderHook(() => useActionRequiredCallback(state, 0 as PlayerIndex, callback));
    expect(callback).not.toHaveBeenCalled();
  });

  it('calls callback when action transitions from not required to required', () => {
    const callback = vi.fn();
    // Start with no action required (different bidder)
    let state = makeState({ phase: 'bidding', currentBidder: 1 });
    const { rerender } = renderHook(
      ({ s }: { s: GameState }) => useActionRequiredCallback(s, 0 as PlayerIndex, callback),
      { initialProps: { s: state } }
    );

    expect(callback).not.toHaveBeenCalled();

    // Now it's our turn — action becomes required
    act(() => {
      state = makeState({ phase: 'bidding', currentBidder: 0 });
      rerender({ s: state });
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call callback when action stays required', () => {
    const callback = vi.fn();
    let state = makeState({ phase: 'bidding', currentBidder: 0 });
    const { rerender } = renderHook(
      ({ s }: { s: GameState }) => useActionRequiredCallback(s, 0 as PlayerIndex, callback),
      { initialProps: { s: state } }
    );

    // Stays required — same phase, same bidder
    act(() => {
      state = makeState({ phase: 'bidding', currentBidder: 0 });
      rerender({ s: state });
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not call callback when action transitions from required to not required', () => {
    const callback = vi.fn();
    // Start with action required
    let state = makeState({ phase: 'bidding', currentBidder: 0 });
    const { rerender } = renderHook(
      ({ s }: { s: GameState }) => useActionRequiredCallback(s, 0 as PlayerIndex, callback),
      { initialProps: { s: state } }
    );

    // Action goes away — other player's turn
    act(() => {
      state = makeState({ phase: 'bidding', currentBidder: 1 });
      rerender({ s: state });
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('returns the same result as useActionRequired', () => {
    const state = makeState({ phase: 'tricks', currentPlayer: 1 });
    const { result } = renderHook(() =>
      useActionRequiredCallback(state, 1 as PlayerIndex, vi.fn())
    );
    expect(result.current).toBe(true);
  });
});
