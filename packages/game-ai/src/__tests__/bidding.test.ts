/**
 * Bidding: the AI has to price in the dabb it will pick up if it wins.
 *
 * A hand one card short of a Familie is worth far more than the melds it can show right now,
 * and only `evaluateBestSuitWithDabb` sees that. The sampling is fed a seeded RNG here so the
 * expectations are exact rather than "usually".
 */
import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@dabb/shared-types';
import { evaluateBestSuit, evaluateBestSuitWithDabb } from '../BinokelAIPlayer.js';

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

/** Deterministic LCG so the Monte Carlo sampling is reproducible across runs. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Herz Ass/10/König/Ober — a Paar on the table, one Herz Buabe short of a Familie. Both copies
 * of that Buabe are unseen, so the dabb completes it reasonably often.
 */
const NEAR_FAMILIE: Card[] = [
  card('herz', 'ass'),
  card('herz', '10'),
  card('herz', 'koenig'),
  card('herz', 'ober'),
  card('kreuz', '10'),
  card('kreuz', 'buabe'),
  card('schippe', '10'),
  card('schippe', 'buabe'),
  card('bollen', 'buabe'),
];

/** Scattered low cards — nothing sitting one card away from a big meld. */
const SCATTERED: Card[] = [
  card('kreuz', 'ass'),
  card('kreuz', '10'),
  card('kreuz', 'koenig'),
  card('schippe', '10'),
  card('schippe', 'buabe'),
  card('herz', 'buabe'),
  card('herz', 'ober'),
  card('bollen', 'ass'),
  card('bollen', 'buabe'),
];

describe('evaluateBestSuitWithDabb', () => {
  it('values a hand that is one card short of a Familie above its melds on the table', () => {
    const base = evaluateBestSuit(NEAR_FAMILIE);
    const withDabb = evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 200, seeded(1));

    // Herz König + Ober is a Paar in trump: 40.
    expect(base.meldPoints).toBe(40);
    expect(withDabb.meldPoints).toBeGreaterThan(base.meldPoints + 10);
  });

  it('picks the suit the dabb is most likely to pay off in', () => {
    expect(evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 200, seeded(2)).bestSuit).toBe('herz');
  });

  it('rates a near-Familie hand above a scattered one of the same shape', () => {
    const nearGain =
      evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 200, seeded(3)).meldPoints -
      evaluateBestSuit(NEAR_FAMILIE).meldPoints;
    const scatteredGain =
      evaluateBestSuitWithDabb(SCATTERED, 4, 200, seeded(3)).meldPoints -
      evaluateBestSuit(SCATTERED).meldPoints;

    expect(nearGain).toBeGreaterThan(scatteredGain);
  });

  it('never estimates below the melds already in hand', () => {
    // Adding cards cannot remove a meld, so the dabb estimate is monotone. A negative gain
    // would mean the shading is applied to the wrong baseline.
    for (const hand of [NEAR_FAMILIE, SCATTERED]) {
      for (const playerCount of [2, 3, 4] as const) {
        const base = evaluateBestSuit(hand);
        const withDabb = evaluateBestSuitWithDabb(hand, playerCount, 30, seeded(4));
        expect(withDabb.meldPoints).toBeGreaterThanOrEqual(base.meldPoints);
      }
    }
  });

  it('is deterministic for a given RNG', () => {
    const a = evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 24, seeded(5));
    const b = evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 24, seeded(5));
    expect(a).toEqual(b);
  });

  it('falls back to the hand melds when sampling is switched off', () => {
    expect(evaluateBestSuitWithDabb(NEAR_FAMILIE, 4, 0, seeded(6))).toEqual(
      evaluateBestSuit(NEAR_FAMILIE)
    );
  });
});
