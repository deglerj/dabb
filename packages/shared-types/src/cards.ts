/**
 * Card-related types for Binokel (Swabian variant)
 */

export const SUITS = ['kreuz', 'schippe', 'herz', 'bollen'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['buabe', 'ober', 'koenig', '10', 'ass'] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_POINTS: Record<Rank, number> = {
  buabe: 2,
  ober: 3,
  koenig: 4,
  '10': 10,
  ass: 11,
};

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  copy: 0 | 1; // Each card exists twice in the deck
}

export type CardId = string;

// Suit display names (Swabian German)
export const SUIT_NAMES: Record<Suit, string> = {
  kreuz: 'Kreuz',
  schippe: 'Schippe',
  herz: 'Herz',
  bollen: 'Bollen',
};

// Rank display names (Swabian German)
export const RANK_NAMES: Record<Rank, string> = {
  buabe: 'Buabe',
  ober: 'Ober',
  koenig: 'König',
  '10': 'Zehn',
  ass: 'Ass',
};
