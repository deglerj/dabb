import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@dabb/shared-types';
import { computeMeldCardIds } from '../meldHighlighting.js';

const card = (suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  copy,
});

// Herz König + Herz Ober = Paar; the two Kreuz cards are in no meld.
const hand = [
  card('herz', 'koenig'),
  card('herz', 'ober'),
  card('kreuz', 'ass'),
  card('kreuz', '10'),
];

describe('computeMeldCardIds', () => {
  it('marks the cards of a Paar and nothing else', () => {
    const result = computeMeldCardIds('bidding', hand, null);
    expect(result).toEqual(new Set(['herz-koenig-0', 'herz-ober-0']));
  });

  it('is independent of the declared trump', () => {
    expect(computeMeldCardIds('melding', hand, 'herz')).toEqual(
      computeMeldCardIds('melding', hand, 'kreuz')
    );
  });

  it('covers dabb, trump and discard phases', () => {
    for (const phase of ['dabb', 'trump', 'discard'] as const) {
      expect(computeMeldCardIds(phase, hand, 'herz').size).toBe(2);
    }
  });

  it('marks nothing in the tricks phase', () => {
    expect(computeMeldCardIds('tricks', hand, 'herz').size).toBe(0);
  });

  it('marks nothing in the scoring phase', () => {
    expect(computeMeldCardIds('scoring', hand, 'herz').size).toBe(0);
  });
});
