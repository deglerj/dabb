/**
 * Regression tests for whoActsNext.
 *
 * Automated players used to key off `state.currentPlayer`, which the reducer only sets from
 * MELDING_COMPLETE onwards. In an online game that left AI seats idle through bidding,
 * dabb, trump and melding — a session with AI players could not get past bidding.
 */

import { describe, expect, it } from 'vitest';
import type { GameState, Meld, PlayerIndex } from '@dabb/shared-types';

import { createInitialState } from '../state/initial.js';
import { whoActsNext } from '../state/turn.js';

function makeState(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(4), ...overrides };
}

describe('whoActsNext', () => {
  it('returns the current bidder during bidding (regression)', () => {
    expect(whoActsNext(makeState({ phase: 'bidding', currentBidder: 2 as PlayerIndex }))).toBe(2);
  });

  it('returns the bid winner during the dabb and trump phases (regression)', () => {
    expect(whoActsNext(makeState({ phase: 'dabb', bidWinner: 1 as PlayerIndex }))).toBe(1);
    expect(whoActsNext(makeState({ phase: 'trump', bidWinner: 1 as PlayerIndex }))).toBe(1);
  });

  it('returns the next player who still owes melds (regression)', () => {
    const declaredMelds = new Map<PlayerIndex, Meld[]>([[0 as PlayerIndex, []]]);
    expect(whoActsNext(makeState({ phase: 'melding', declaredMelds }))).toBe(1);
  });

  it('skips a bid winner who went out while melding', () => {
    const state = makeState({
      phase: 'melding',
      declaredMelds: new Map<PlayerIndex, Meld[]>(),
      wentOut: true,
      bidWinner: 0 as PlayerIndex,
    });
    expect(whoActsNext(state)).toBe(1);
  });

  it('returns null once everyone who owes melds has declared', () => {
    const declaredMelds = new Map<PlayerIndex, Meld[]>(
      ([0, 1, 2, 3] as PlayerIndex[]).map((i) => [i, [] as Meld[]])
    );
    expect(whoActsNext(makeState({ phase: 'melding', declaredMelds }))).toBeNull();
  });

  it('returns the current player during tricks', () => {
    expect(whoActsNext(makeState({ phase: 'tricks', currentPlayer: 3 as PlayerIndex }))).toBe(3);
  });

  it('returns null in phases nobody acts in', () => {
    expect(whoActsNext(makeState({ phase: 'scoring' }))).toBeNull();
    expect(whoActsNext(makeState({ phase: 'finished' }))).toBeNull();
    expect(whoActsNext(makeState({ phase: 'waiting' }))).toBeNull();
  });
});
