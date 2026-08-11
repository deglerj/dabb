import { detectMelds } from '@dabb/game-logic';
import type { Card, GamePhase, Suit } from '@dabb/shared-types';

const MELD_PHASES: GamePhase[] = ['bidding', 'dabb', 'trump', 'discard', 'melding'];

/**
 * Card ids that are part of at least one meld, for tinting the hand.
 *
 * Deliberately off during `tricks` — by then the melds are scored and the tint would only
 * compete with the valid-play dimming.
 *
 * Trump is passed through only because `detectMelds` wants it for the trump *bonus*; it never
 * changes which cards form a meld, so the fallback used before trump is declared is arbitrary.
 */
export function computeMeldCardIds(
  phase: GamePhase,
  cards: Card[],
  trump: Suit | null
): Set<string> {
  if (!MELD_PHASES.includes(phase)) {
    return new Set();
  }
  return new Set(detectMelds(cards, trump ?? 'herz').flatMap((m) => m.cards));
}
