/**
 * Card asset utilities
 */

import type { Suit, Rank } from '@dabb/shared-types';

export const SUIT_COLORS: Record<Suit, { primary: string; secondary: string }> = {
  kreuz: { primary: '#C4941A', secondary: '#3C5E26' }, // Acorn golden / olive green
  schippe: { primary: '#1E7B1E', secondary: '#145A14' }, // Leaf forest green
  herz: { primary: '#C41E3A', secondary: '#A01830' }, // Royal Red
  bollen: { primary: '#9B1515', secondary: '#C89000' }, // Quartered ball: crimson / gold
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
