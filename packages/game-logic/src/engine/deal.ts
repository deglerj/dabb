/**
 * Dealing a fresh round.
 */

import type { Card, CardsDealtEvent, PlayerCount, PlayerIndex } from '@dabb/shared-types';
import { createDeck, dealCards, shuffleDeck } from '../cards/index.js';
import { createCardsDealtEvent } from '../events/index.js';
import type { NextContext } from './context.js';

/**
 * Shuffles a fresh deck and deals it, as a single CARDS_DEALT event.
 *
 * Every start of a round goes through here — the initial deal and each new round in all
 * three engines — so the deck used at the table is always built the same way.
 */
export function createDealEvent(next: NextContext, playerCount: PlayerCount): CardsDealtEvent {
  const { hands, dabb } = dealCards(shuffleDeck(createDeck()), playerCount);
  const handsRecord = {} as Record<PlayerIndex, Card[]>;
  hands.forEach((cards, index) => {
    handsRecord[index as PlayerIndex] = cards;
  });
  return createCardsDealtEvent(next(), handsRecord, dabb);
}
