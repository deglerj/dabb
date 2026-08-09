/**
 * Card asset utilities
 */

import type { Suit, Rank } from '@dabb/shared-types';

export const SUIT_COLORS: Record<Suit, { primary: string; secondary: string }> = {
  kreuz: { primary: '#C4941A', secondary: '#3C5E26' }, // Acorn golden / olive green
  schippe: { primary: '#1E7B1E', secondary: '#145A14' }, // Leaf forest green
  herz: { primary: '#C41E3A', secondary: '#A01830' }, // Royal Red
  bollen: { primary: '#D46A00', secondary: '#9B1515' }, // Quartered ball: orange / crimson
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  kreuz: '♣\uFE0E',
  schippe: '♠\uFE0E',
  herz: '♥\uFE0E',
  bollen: '♦\uFE0E',
};

export const RANK_DISPLAY: Record<Rank, string> = {
  buabe: 'B',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

export function getSuitColor(suit: Suit): string {
  return SUIT_COLORS[suit].primary;
}
