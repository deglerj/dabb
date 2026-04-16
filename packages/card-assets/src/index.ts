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

/**
 * Background band colors for face cards (König/Ober/Buabe), keyed by rank.
 * Each entry has a band color and a contrasting text color.
 */
export const FACE_CARD_BAND: Record<'koenig' | 'ober' | 'buabe', { band: string; text: string }> = {
  koenig: { band: '#8B0000', text: '#FFD700' }, // deep red / gold crown colors
  ober: { band: '#1A3D6B', text: '#E8D8A0' }, // dark navy / parchment
  buabe: { band: '#2D5A1B', text: '#F0E68C' }, // forest green / khaki
};

export function getSuitColor(suit: Suit): string {
  return SUIT_COLORS[suit].primary;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'herz' || suit === 'bollen';
}
