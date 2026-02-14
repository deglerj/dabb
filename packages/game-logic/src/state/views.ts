/**
 * Player view filtering (anti-cheat)
 *
 * Filters game events to only show information a specific player should see.
 */

import { Card, GameEvent, PlayerIndex } from '@dabb/shared-types';

/**
 * Filter events for a specific player's view
 * This ensures players can't see other players' cards
 */
export function filterEventsForPlayer(events: GameEvent[], playerIndex: PlayerIndex): GameEvent[] {
  return events.map((event) => filterEventForPlayer(event, playerIndex));
}

/**
 * Filter a single event for a player
 */
export function filterEventForPlayer(event: GameEvent, playerIndex: PlayerIndex): GameEvent {
  switch (event.type) {
    case 'CARDS_DEALT':
      return filterCardsDealt(event, playerIndex);

    case 'CARDS_DISCARDED':
      return filterCardsDiscarded(event, playerIndex);

    default:
      return event;
  }
}

/**
 * Filter CARDS_DEALT - only show player's own hand
 */
function filterCardsDealt(
  event: Extract<GameEvent, { type: 'CARDS_DEALT' }>,
  playerIndex: PlayerIndex
): GameEvent {
  const filteredHands: Record<number, Card[]> = {};

  for (const [indexStr, cards] of Object.entries(event.payload.hands)) {
    const idx = parseInt(indexStr) as PlayerIndex;
    if (idx === playerIndex) {
      filteredHands[idx] = cards;
    } else {
      // Show card count but not actual cards
      filteredHands[idx] = createHiddenCards(cards.length);
    }
  }

  return {
    ...event,
    payload: {
      ...event.payload,
      hands: filteredHands,
      // Hide dabb until revealed to bid winner
      dabb: createHiddenCards(event.payload.dabb.length),
    },
  };
}

/**
 * Filter CARDS_DISCARDED - hide which cards were discarded
 */
function filterCardsDiscarded(
  event: Extract<GameEvent, { type: 'CARDS_DISCARDED' }>,
  playerIndex: PlayerIndex
): GameEvent {
  if (event.payload.playerIndex === playerIndex) {
    return event;
  }

  return {
    ...event,
    payload: {
      ...event.payload,
      // Show count but not actual card IDs
      discardedCards: Array(event.payload.discardedCards.length).fill('hidden'),
    },
  };
}

/**
 * Create placeholder hidden cards
 */
function createHiddenCards(count: number): Card[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: `hidden-${i}`,
      suit: 'kreuz' as const,
      rank: 'buabe' as const,
      copy: 0 as const,
    }));
}

/**
 * Check if a card is hidden (placeholder)
 */
export function isHiddenCard(card: Card): boolean {
  return card.id.startsWith('hidden-');
}
