/**
 * Card asset utilities
 */

import type { Suit, Rank } from '@dabb/shared-types';

export const SUIT_COLORS: Record<Suit, { primary: string; secondary: string }> = {
  kreuz: { primary: '#8B4513', secondary: '#A0522D' },
  schippe: { primary: '#228B22', secondary: '#006400' },
  herz: { primary: '#dc2626', secondary: '#b91c1c' },
  bollen: { primary: '#FFD700', secondary: '#DAA520' },
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
