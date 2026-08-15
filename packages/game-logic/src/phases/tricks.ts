/**
 * Trick-taking logic for Binokel
 */

import {
  Card,
  CardId,
  type Player,
  type PlayerIndex,
  RANK_POINTS,
  Rank,
  Suit,
  Trick,
} from '@dabb/shared-types';

/**
 * Card strength ordering (higher index = stronger)
 *
 * Exported because the AI reasons about the same ordering when it counts cards. It used to
 * keep its own copy, which is two tables that have to agree about who wins a trick.
 */
export const CARD_STRENGTH: Record<Rank, number> = {
  buabe: 0,
  ober: 1,
  koenig: 2,
  '10': 3,
  ass: 4,
};

/**
 * Determine which card wins a trick
 * Returns the index within the trick's cards array
 */
export function determineTrickWinner(trick: Trick, trump: Suit): number {
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
export function cardBeats(cardA: Card, cardB: Card, leadSuit: Suit, trump: Suit): boolean {
  const aIsTrump = cardA.suit === trump;
  const bIsTrump = cardB.suit === trump;
  const aIsLead = cardA.suit === leadSuit;
  const bIsLead = cardB.suit === leadSuit;

  // Trump beats non-trump
  if (aIsTrump && !bIsTrump) {
    return true;
  }
  if (!aIsTrump && bIsTrump) {
    return false;
  }

  // Both trump: higher strength wins
  if (aIsTrump && bIsTrump) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }

  // Neither trump: lead suit beats non-lead
  if (aIsLead && !bIsLead) {
    return true;
  }
  if (!aIsLead && bIsLead) {
    return false;
  }

  // Same suit (both lead or both non-lead): higher strength wins
  if (cardA.suit === cardB.suit) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }

  // Different non-trump, non-lead suits: first one (cardB) wins
  return false;
}

/**
 * The player currently winning an in-progress trick, or null if no card has been played.
 *
 * Note this is *not* `trick.winnerIndex` — the reducer only fills that in on a completed
 * trick, so mid-trick it is always null.
 */
export function getCurrentTrickWinner(trick: Trick, trump: Suit): PlayerIndex | null {
  if (trick.cards.length === 0) {
    return null;
  }
  return trick.cards[determineTrickWinner(trick, trump)].playerIndex;
}

/**
 * The partner of a player in a 4-player (team) game, or null in 2/3-player games.
 */
export function getPartnerIndex(players: Player[], playerIndex: PlayerIndex): PlayerIndex | null {
  const me = players.find((p) => p.playerIndex === playerIndex);
  if (me?.team === undefined) {
    return null;
  }
  const partner = players.find((p) => p.team === me.team && p.playerIndex !== playerIndex);
  return partner?.playerIndex ?? null;
}

/**
 * Whether the player's own partner is currently winning the trick (4-player games only).
 * Pass the result to `getValidPlays`/`isValidPlay` to apply the partner exemption.
 */
export function isPartnerWinning(
  trick: Trick,
  trump: Suit,
  playerIndex: PlayerIndex,
  players: Player[]
): boolean {
  const partner = getPartnerIndex(players, playerIndex);
  if (partner === null) {
    return false;
  }
  return getCurrentTrickWinner(trick, trump) === partner;
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
 *
 * Partner exemption (4-player games): when `partnerWinning` is true, rules 2–4 are lifted
 * — the trick already belongs to your team, so you need not overtake your own partner nor
 * spend a trump on them. Rule 1 (follow suit) still applies.
 */
export function getValidPlays(
  hand: Card[],
  trick: Trick,
  trump: Suit,
  partnerWinning = false
): Card[] {
  // First card of trick: any card is valid
  if (trick.cards.length === 0 || !trick.leadSuit) {
    return hand;
  }

  const leadSuit = trick.leadSuit;

  // Find cards of lead suit in hand
  const leadSuitCards = hand.filter((c) => c.suit === leadSuit);

  if (leadSuitCards.length > 0) {
    // Must follow suit
    if (partnerWinning) {
      return leadSuitCards;
    }

    const highestLeadInTrick = getHighestCardOfSuit(trick, leadSuit);

    // Must beat if possible
    const beatingCards = leadSuitCards.filter((c) =>
      highestLeadInTrick ? cardBeats(c, highestLeadInTrick, leadSuit, trump) : true
    );

    return beatingCards.length > 0 ? beatingCards : leadSuitCards;
  }

  // Cannot follow suit — free to discard anything if the partner already has the trick
  if (partnerWinning) {
    return hand;
  }

  // Must trump if possible
  const trumpCards = hand.filter((c) => c.suit === trump);

  if (trumpCards.length > 0) {
    const highestTrumpInTrick = getHighestCardOfSuit(trick, trump);

    // Must beat highest trump if possible
    const beatingTrumps = trumpCards.filter((c) =>
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
  trump: Suit,
  partnerWinning = false
): boolean {
  const validPlays = getValidPlays(hand, trick, trump, partnerWinning);
  return validPlays.some((c) => c.id === card.id);
}

/**
 * Calculate points in a collection of cards
 */
export function calculateTrickPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + RANK_POINTS[card.rank], 0);
}

/**
 * Bonus points awarded for winning the last trick
 */
export const LAST_TRICK_BONUS = 10;

/**
 * Calculate raw (pre-rounding) trick points for a player, including the last trick bonus.
 */
export function calculatePlayerTrickRawPoints(
  playerIndex: PlayerIndex,
  tricksTaken: Map<PlayerIndex, Card[][]>,
  lastTrickWinner: PlayerIndex | null
): number {
  const tricks = tricksTaken.get(playerIndex) ?? [];
  const raw = tricks.reduce((sum, trick) => sum + calculateTrickPoints(trick), 0);
  return raw + (lastTrickWinner === playerIndex ? LAST_TRICK_BONUS : 0);
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
function getHighestCardOfSuit(trick: Trick, suit: Suit): Card | null {
  const cardsOfSuit = trick.cards
    .map((pc) => findCardById(pc.cardId))
    .filter((c) => c.suit === suit);

  if (cardsOfSuit.length === 0) {
    return null;
  }

  return cardsOfSuit.reduce((highest, card) =>
    CARD_STRENGTH[card.rank] > CARD_STRENGTH[highest.rank] ? card : highest
  );
}
