/**
 * Player view filtering (anti-cheat)
 *
 * Filters game events to only show information a specific player should see.
 */

import { Card, GameEvent, PlayerIndex, Suit } from '@dabb/shared-types';

/**
 * Filter events for a specific player's view
 * This ensures players can't see other players' cards
 *
 * Must be given the whole log (or at least everything back to the current round's
 * TRUMP_DECLARED): revealing the bid winner's buried trump needs the trump suit, which only
 * an earlier event carries. Filtering batches in isolation loses it.
 */
export function filterEventsForPlayer(events: GameEvent[], playerIndex: PlayerIndex): GameEvent[] {
  let trump: Suit | null = null;

  return events.map((event) => {
    if (event.type === 'TRUMP_DECLARED' || event.type === 'GOING_OUT') {
      trump = event.payload.suit;
    } else if (event.type === 'NEW_ROUND_STARTED') {
      trump = null;
    }
    return filterEventForPlayer(event, playerIndex, trump);
  });
}

/**
 * Filter a single event for a player.
 *
 * `trump` is the suit declared in the current round, or null before it is declared. Without
 * it a CARDS_DISCARDED event is hidden in full — safe, but it withholds the buried trump
 * the bid winner is required to announce.
 *
 * BIDDING_WON is deliberately not filtered: the Dabb is turned face up for the whole table,
 * so its cards stay in the event for everyone (the client shows them once the bid winner
 * picks them up). Hiding it here never hid anything anyway — DABB_TAKEN carries the same
 * four cards one event later, and that one has to stay readable to move them into the hand.
 */
export function filterEventForPlayer(
  event: GameEvent,
  playerIndex: PlayerIndex,
  trump: Suit | null = null
): GameEvent {
  switch (event.type) {
    case 'CARDS_DEALT':
      return filterCardsDealt(event, playerIndex);

    case 'CARDS_DISCARDED':
      return filterCardsDiscarded(event, playerIndex, trump);

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
 * Filter CARDS_DISCARDED — the layaway is face down, except for trump.
 *
 * Burying a trump card is legal but must be announced, so trump-suited discards stay visible
 * to everyone while the rest become placeholders. The reveal is derived here by each
 * receiving client from the card IDs (`suit-rank-copy`), not reported by the discarder: the
 * IDs have to be the real ones, or the reducer would strip the wrong cards from their hand.
 */
function filterCardsDiscarded(
  event: Extract<GameEvent, { type: 'CARDS_DISCARDED' }>,
  playerIndex: PlayerIndex,
  trump: Suit | null
): GameEvent {
  if (event.payload.playerIndex === playerIndex) {
    return event;
  }

  return {
    ...event,
    payload: {
      ...event.payload,
      discardedCards: event.payload.discardedCards.map((cardId) =>
        trump !== null && cardId.startsWith(`${trump}-`) ? cardId : 'hidden'
      ),
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
