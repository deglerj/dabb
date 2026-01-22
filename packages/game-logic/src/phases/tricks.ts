/**
 * Trick-taking logic for Binokel
 */

import {
  Card,
  CardId,
  RANK_POINTS,
  Rank,
  Suit,
  Trick,
} from '@dabb/shared-types';

/**
 * Card strength ordering (higher index = stronger)
 */
const CARD_STRENGTH: Record<Rank, number> = {
  '9': 0,
  buabe: 1,
  ober: 2,
  koenig: 3,
  '10': 4,
  ass: 5,
};

/**
 * Determine which card wins a trick
 * Returns the index within the trick's cards array
 */
export function determineTrickWinner(
  trick: Trick,
  trump: Suit
): number {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick');
  }

  const leadSuit = trick.leadSuit!;
  let winningIndex = 0;
  let winningCard = findCardById(trick.cards[0].cardId);

  for (let i = 1; i < trick.cards.length; i++) {
    const card = findCardById(trick.cards[i].cardId);

    if (cardBeats(card, winningCard, leadSuit, trump)) {
      winningIndex = i;
      winningCard = card;
    }
  }

  return winningIndex;
}

/**
 * Check if cardA beats cardB given lead suit and trump
 */
function cardBeats(
  cardA: Card,
  cardB: Card,
  leadSuit: Suit,
  trump: Suit
): boolean {
  const aIsTrump = cardA.suit === trump;
  const bIsTrump = cardB.suit === trump;
  const aIsLead = cardA.suit === leadSuit;
  const bIsLead = cardB.suit === leadSuit;

  // Trump beats non-trump
  if (aIsTrump && !bIsTrump) return true;
  if (!aIsTrump && bIsTrump) return false;

  // Both trump: higher strength wins
  if (aIsTrump && bIsTrump) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }

  // Neither trump: lead suit beats non-lead
  if (aIsLead && !bIsLead) return true;
  if (!aIsLead && bIsLead) return false;

  // Same suit (both lead or both non-lead): higher strength wins
  if (cardA.suit === cardB.suit) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }

  // Different non-trump, non-lead suits: first one (cardB) wins
  return false;
}

/**
 * Get valid cards that can be played
 *
 * Binokel rules:
 * 1. Must follow suit if possible
 * 2. If following suit, must beat highest card of that suit if possible
 * 3. If cannot follow suit, must play trump if possible
 * 4. If playing trump, must beat highest trump if possible
 * 5. If cannot follow or trump, any card is valid
 */
export function getValidPlays(
  hand: Card[],
  trick: Trick,
  trump: Suit
): Card[] {
  // First card of trick: any card is valid
  if (trick.cards.length === 0 || !trick.leadSuit) {
    return hand;
  }

  const leadSuit = trick.leadSuit;

  // Find cards of lead suit in hand
  const leadSuitCards = hand.filter(c => c.suit === leadSuit);

  if (leadSuitCards.length > 0) {
    // Must follow suit
    const highestLeadInTrick = getHighestCardOfSuit(trick, leadSuit);

    // Must beat if possible
    const beatingCards = leadSuitCards.filter(c =>
      highestLeadInTrick ? cardBeats(c, highestLeadInTrick, leadSuit, trump) : true
    );

    return beatingCards.length > 0 ? beatingCards : leadSuitCards;
  }

  // Cannot follow suit - must trump if possible
  const trumpCards = hand.filter(c => c.suit === trump);

  if (trumpCards.length > 0) {
    const highestTrumpInTrick = getHighestCardOfSuit(trick, trump);

    // Must beat highest trump if possible
    const beatingTrumps = trumpCards.filter(c =>
      highestTrumpInTrick ? cardBeats(c, highestTrumpInTrick, trump, trump) : true
    );

    return beatingTrumps.length > 0 ? beatingTrumps : trumpCards;
  }

  // Cannot follow or trump - any card is valid
  return hand;
}

/**
 * Check if a specific card can be played
 */
export function isValidPlay(
  card: Card,
  hand: Card[],
  trick: Trick,
  trump: Suit
): boolean {
  const validPlays = getValidPlays(hand, trick, trump);
  return validPlays.some(c => c.id === card.id);
}

/**
 * Calculate points in a collection of cards
 */
export function calculateTrickPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + RANK_POINTS[card.rank], 0);
}

/**
 * Helper to find card by ID (parses the card ID format)
 */
function findCardById(cardId: CardId): Card {
  // Parse the card ID format: "suit-rank-copy"
  const [suit, rank, copy] = cardId.split('-') as [Suit, Rank, string];
  return {
    id: cardId,
    suit,
    rank,
    copy: parseInt(copy) as 0 | 1,
  };
}

/**
 * Get highest card of a specific suit in a trick
 */
function getHighestCardOfSuit(
  trick: Trick,
  suit: Suit
): Card | null {
  const cardsOfSuit = trick.cards
    .map(pc => findCardById(pc.cardId))
    .filter(c => c.suit === suit);

  if (cardsOfSuit.length === 0) return null;

  return cardsOfSuit.reduce((highest, card) =>
    CARD_STRENGTH[card.rank] > CARD_STRENGTH[highest.rank] ? card : highest
  );
}
