/**
 * Deck creation and shuffling for Binokel
 */

import {
  Card,
  CARDS_PER_PLAYER,
  DABB_SIZE,
  PlayerCount,
  PlayerIndex,
  RANKS,
  Rank,
  SUITS,
  Suit,
} from '@dabb/shared-types';

/**
 * Create a unique card ID
 */
function createCardId(suit: Suit, rank: Rank, copy: 0 | 1): string {
  return `${suit}-${rank}-${copy}`;
}

/**
 * Create a full 48-card Binokel deck (2 copies of each card)
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      for (const copy of [0, 1] as const) {
        deck.push({
          id: createCardId(suit, rank, copy),
          suit,
          rank,
          copy,
        });
      }
    }
  }

  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Deal cards to players and dabb based on player count
 */
export function dealCards(
  deck: Card[],
  playerCount: PlayerCount
): {
  hands: Map<PlayerIndex, Card[]>;
  dabb: Card[];
} {
  const cardsPerPlayer = CARDS_PER_PLAYER[playerCount];
  const dabbSize = DABB_SIZE[playerCount];
  const hands = new Map<PlayerIndex, Card[]>();

  let cardIndex = 0;

  // Deal to each player
  for (let p = 0; p < playerCount; p++) {
    const hand: Card[] = [];
    for (let c = 0; c < cardsPerPlayer; c++) {
      hand.push(deck[cardIndex++]);
    }
    hands.set(p as PlayerIndex, hand);
  }

  // Remaining cards go to dabb
  const dabb = deck.slice(cardIndex, cardIndex + dabbSize);

  return { hands, dabb };
}

/**
 * Sort a hand by suit then rank (for display)
 */
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    kreuz: 0,
    schippe: 1,
    herz: 2,
    bollen: 3,
  };

  const rankOrder: Record<Rank, number> = {
    ass: 0,
    '10': 1,
    koenig: 2,
    ober: 3,
    buabe: 4,
    '9': 5,
  };

  return [...cards].sort((a, b) => {
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) {return suitDiff;}
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}
