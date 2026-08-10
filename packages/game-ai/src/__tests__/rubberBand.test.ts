/**
 * Rubber band: on easy and medium the AI makes *more* mistakes while it is ahead.
 *
 * The band can only ever add to the mistake rate of the chosen difficulty — falling behind
 * restores that rate and nothing more, so an easy bot never quietly turns into a hard one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState } from '@dabb/game-logic';
import type { Card, GameState, PlayerIndex, Rank, Suit, Team } from '@dabb/shared-types';
import { createAIPlayer, partnersHuman } from '../AIPlayer.js';
import { effectiveMistakeProbability, RUBBER_BAND_SPAN } from '../BinokelAIPlayer.js';

const EASY_BASE = 0.35;
const EASY_STRENGTH = 0.35;

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

/** State with cumulative scores only — enough for the probability helper. */
function scoredState(
  playerCount: 2 | 3 | 4,
  totals: Array<[PlayerIndex | Team, number]>
): GameState {
  return {
    ...createInitialState(playerCount),
    totalScores: new Map<PlayerIndex | Team, number>(totals),
  };
}

describe('rubber band mistake rate', () => {
  it('leaves the rate untouched when the AI has no lead', () => {
    const state = scoredState(2, [
      [0 as PlayerIndex, 300],
      [1 as PlayerIndex, 300],
    ]);
    expect(effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, state, 0 as PlayerIndex)).toBe(
      EASY_BASE
    );
  });

  it('never dips below the base rate when the AI is behind', () => {
    const state = scoredState(2, [
      [0 as PlayerIndex, 100],
      [1 as PlayerIndex, 700],
    ]);
    expect(effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, state, 0 as PlayerIndex)).toBe(
      EASY_BASE
    );
  });

  it('reaches base + strength at a full-span lead and stops there', () => {
    const atSpan = scoredState(2, [
      [0 as PlayerIndex, 200 + RUBBER_BAND_SPAN],
      [1 as PlayerIndex, 200],
    ]);
    const wayPast = scoredState(2, [
      [0 as PlayerIndex, 900],
      [1 as PlayerIndex, 100],
    ]);
    expect(
      effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, atSpan, 0 as PlayerIndex)
    ).toBeCloseTo(0.7);
    expect(
      effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, wayPast, 0 as PlayerIndex)
    ).toBeCloseTo(0.7);
  });

  it('scales linearly for a partial lead', () => {
    const half = scoredState(2, [
      [0 as PlayerIndex, RUBBER_BAND_SPAN / 2],
      [1 as PlayerIndex, 0],
    ]);
    expect(
      effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, half, 0 as PlayerIndex)
    ).toBeCloseTo(EASY_BASE + EASY_STRENGTH / 2);
  });

  it('measures the lead against the best opponent, not the weakest (3-player)', () => {
    const state = scoredState(3, [
      [0 as PlayerIndex, 500],
      [1 as PlayerIndex, 500],
      [2 as PlayerIndex, 0],
    ]);
    expect(effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, state, 0 as PlayerIndex)).toBe(
      EASY_BASE
    );
  });

  it('hard difficulty (strength 0) stays at zero however far ahead it is', () => {
    const state = scoredState(2, [
      [0 as PlayerIndex, 900],
      [1 as PlayerIndex, 0],
    ]);
    expect(effectiveMistakeProbability(0, 0, state, 0 as PlayerIndex)).toBe(0);
  });

  it('reads team totals, not seat totals, in a 4-player game', () => {
    // Keys here are Teams. Team 1 leads by a full span, so seat 3 (team 1) is banded and
    // seat 2 (team 0) is not — even though as *seat* indices 0/1 would say the opposite.
    const state = scoredState(4, [
      [0 as Team, 100],
      [1 as Team, 100 + RUBBER_BAND_SPAN],
    ]);
    expect(
      effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, state, 3 as PlayerIndex)
    ).toBeCloseTo(0.7);
    expect(effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, state, 2 as PlayerIndex)).toBe(
      EASY_BASE
    );
  });

  it('falls back to the base rate before the first round is scored', () => {
    expect(
      effectiveMistakeProbability(EASY_BASE, EASY_STRENGTH, createInitialState(2), 0 as PlayerIndex)
    ).toBe(EASY_BASE);
  });
});

describe('rubber band exemption for a human’s partner', () => {
  it('exempts only the seat opposite the human, and only in 4-player games', () => {
    const humanSeat = 0;
    const isHuman = (index: number): boolean => index === humanSeat;
    expect(partnersHuman(4, 2, isHuman)).toBe(true);
    expect(partnersHuman(4, 1, isHuman)).toBe(false);
    expect(partnersHuman(4, 3, isHuman)).toBe(false);
    // 2- and 3-player games have no partners at all
    expect(partnersHuman(2, 1, isHuman)).toBe(false);
    expect(partnersHuman(3, 2, isHuman)).toBe(false);
  });
});

describe('rubber band applied to a real decision', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Trump declaration for a leading seat 0. Herz is clearly the best suit (a Familie plus the
   * most trump), so the optimal call is herz and anything else is a blunder.
   */
  function trumpChoice(): GameState {
    const hand = [
      card('herz', 'ass'),
      card('herz', '10'),
      card('herz', 'koenig'),
      card('herz', 'ober'),
      card('herz', 'buabe'),
      card('kreuz', 'buabe'),
    ];
    return {
      ...createInitialState(2),
      phase: 'trump',
      round: 1,
      bidWinner: 0 as PlayerIndex,
      currentBid: 150,
      hands: new Map<PlayerIndex, Card[]>([
        [0 as PlayerIndex, hand],
        [1 as PlayerIndex, []],
      ]),
      totalScores: new Map<PlayerIndex | Team, number>([
        [0 as PlayerIndex, 400],
        [1 as PlayerIndex, 0],
      ]),
    };
  }

  it('a leading easy AI blunders at a rate its unbanded self would not', async () => {
    // 0.5 sits above the flat easy rate (0.35) but below the banded one (0.7), so the same
    // draw blunders for one AI and not the other. Also picks alternative index 1, deterministically.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = { gameState: trumpChoice(), playerIndex: 0 as PlayerIndex, sessionId: 't' };

    const banded = await createAIPlayer('easy').decide(context);
    const exempt = await createAIPlayer('easy', false).decide(context);

    expect(banded).toEqual({ type: 'declareTrump', suit: expect.not.stringMatching(/^herz$/) });
    expect(exempt).toEqual({ type: 'declareTrump', suit: 'herz' });
  });
});
