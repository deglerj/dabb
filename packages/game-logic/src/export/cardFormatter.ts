/**
 * Card and meld formatting utilities for human-readable export
 */

import type { Card, Suit, Meld } from '@dabb/shared-types';
import { SUIT_NAMES, RANK_NAMES } from '@dabb/shared-types';

/**
 * Format a single card as human-readable text
 * @example "Herz Ass"
 */
export function formatCard(card: Card): string {
  return `${SUIT_NAMES[card.suit]} ${RANK_NAMES[card.rank]}`;
}

/**
 * Format an array of cards as comma-separated text
 * @example "Herz Ass, Kreuz König, Bollen Ober"
 */
export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(', ');
}

/**
 * Format a suit as human-readable text
 * @example "Herz"
 */
export function formatSuit(suit: Suit): string {
  return SUIT_NAMES[suit];
}

/**
 * Format a meld as human-readable text with points
 * @example "Paar in Herz (40 pts)"
 */
export function formatMeld(meld: Meld): string {
  const meldNames: Record<string, string> = {
    paar: 'Paar',
    familie: 'Familie',
    binokel: 'Binokel',
    'doppel-binokel': 'Doppel-Binokel',
    'vier-ass': 'Vier Ass',
    'vier-zehn': 'Vier Zehn',
    'vier-koenig': 'Vier König',
    'vier-ober': 'Vier Ober',
    'vier-unter': 'Vier Buabe',
    'acht-ass': 'Acht Ass',
    'acht-zehn': 'Acht Zehn',
    'acht-koenig': 'Acht König',
    'acht-ober': 'Acht Ober',
    'acht-unter': 'Acht Buabe',
  };

  const name = meldNames[meld.type] ?? meld.type;
  const suitPart = meld.suit ? ` in ${formatSuit(meld.suit)}` : '';
  return `${name}${suitPart} (${meld.points} pts)`;
}

/**
 * Format an array of melds as a bulleted list
 */
export function formatMelds(melds: Meld[]): string {
  return melds.map((m) => `- ${formatMeld(m)}`).join('\n');
}
