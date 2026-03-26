import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionRequired } from '../useActionRequired.js';
import type { GameState, PlayerIndex } from '@dabb/shared-types';

function makeState(overrides: Partial<GameState>): GameState {
  return {
    phase: 'bidding',
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
  it('returns no action when state is null', () => {
    const { result } = renderHook(() => useActionRequired(null, 0 as PlayerIndex));
    expect(result.current).toEqual({ actionRequired: false, actionType: null });
  });

  it('returns no action when playerIndex is null', () => {
    const state = makeState({ phase: 'bidding', currentBidder: 0 });
    const { result } = renderHook(() => useActionRequired(state, null));
    expect(result.current).toEqual({ actionRequired: false, actionType: null });
  });

  describe('bidding phase', () => {
    it('requires bid action when it is the current player turn', () => {
      const state = makeState({ phase: 'bidding', currentBidder: 1 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'bid' });
    });

    it('requires no action when it is another player turn', () => {
      const state = makeState({ phase: 'bidding', currentBidder: 0 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: false, actionType: null });
    });
  });

  describe('dabb phase', () => {
    it('requires take_dabb action when dabb is not yet taken', () => {
      const state = makeState({
        phase: 'dabb',
        bidWinner: 0,
        dabb: [
          { id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 },
          { id: 'herz-10-0', suit: 'herz', rank: '10', copy: 0 },
        ],
      });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'take_dabb' });
    });

    it('requires discard action when dabb has been taken (empty dabb)', () => {
      const state = makeState({ phase: 'dabb', bidWinner: 0, dabb: [] });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'discard' });
    });

    it('requires no action for non-bid-winner in dabb phase', () => {
      const state = makeState({ phase: 'dabb', bidWinner: 0, dabb: [] });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: false, actionType: null });
    });
  });

  describe('trump phase', () => {
    it('requires declare_trump action for bid winner', () => {
      const state = makeState({ phase: 'trump', bidWinner: 2 });
      const { result } = renderHook(() => useActionRequired(state, 2 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'declare_trump' });
    });

    it('requires no action for non-bid-winner in trump phase', () => {
      const state = makeState({ phase: 'trump', bidWinner: 0 });
      const { result } = renderHook(() => useActionRequired(state, 1 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: false, actionType: null });
    });
  });

  describe('melding phase', () => {
    it('requires declare_melds action when player has not yet declared', () => {
      const declaredMelds = new Map();
      const state = makeState({ phase: 'melding', declaredMelds });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'declare_melds' });
    });

    it('requires no action once player has declared melds', () => {
      const declaredMelds = new Map([[0 as PlayerIndex, [] as never[]]]);
      const state = makeState({ phase: 'melding', declaredMelds });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: false, actionType: null });
    });
  });

  describe('tricks phase', () => {
    it('requires play_card action when it is the current player turn', () => {
      const state = makeState({ phase: 'tricks', currentPlayer: 0 });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: true, actionType: 'play_card' });
    });

    it('requires no action when it is another player turn', () => {
      const state = makeState({ phase: 'tricks', currentPlayer: 1 });
      const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
      expect(result.current).toEqual({ actionRequired: false, actionType: null });
    });
  });

  it('requires no action in finished phase', () => {
    const state = makeState({ phase: 'finished' });
    const { result } = renderHook(() => useActionRequired(state, 0 as PlayerIndex));
    expect(result.current).toEqual({ actionRequired: false, actionType: null });
  });
});
