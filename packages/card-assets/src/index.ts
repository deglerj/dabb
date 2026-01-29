/**
 * Card asset utilities
 */

import type { Suit, Rank } from '@dabb/shared-types';

export const SUIT_COLORS: Record<Suit, { primary: string; secondary: string }> = {
  kreuz: { primary: '#D2B48C', secondary: '#C3A67A' }, // Peanut colored
  schippe: { primary: '#228B22', secondary: '#1E7B1E' }, // Leaf Green
  herz: { primary: '#C41E3A', secondary: '#A01830' }, // Royal Red
  bollen: { primary: '#FFD700', secondary: '#228B22' }, // Gold with Green accent
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  kreuz: '♣',
  schippe: '♠',
  herz: '❤️',
  bollen: '♦',
};

export const RANK_DISPLAY: Record<Rank, string> = {
  buabe: 'U',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

export function getSuitColor(suit: Suit): string {
  return SUIT_COLORS[suit].primary;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'herz' || suit === 'bollen';
}
