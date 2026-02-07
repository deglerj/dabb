/**
 * Binokel AI Player implementation
 *
 * Decision logic for all game phases: bidding, dabb, trump, melding, tricks.
 * See docs/AI_STRATEGY.md for human-readable strategy documentation.
 */

import type {
  AIAction,
  AIDecisionContext,
  Card,
  CardId,
  Rank,
  Suit,
  Trick,
} from '@dabb/shared-types';
import { RANK_POINTS, SUITS } from '@dabb/shared-types';
import {
  calculateMeldPoints,
  canPass,
  detectMelds,
  getMinBid,
  getValidPlays,
} from '@dabb/game-logic';

import type { AIPlayer } from './AIPlayer.js';

/** Card strength ordering (higher = stronger), matching tricks.ts */
const CARD_STRENGTH: Record<Rank, number> = {
  buabe: 0,
  ober: 1,
  koenig: 2,
  '10': 3,
  ass: 4,
};

/**
 * Check if cardA beats cardB given lead suit and trump.
 * Duplicated from tricks.ts (not exported).
 */
function cardWouldWin(cardA: Card, cardB: Card, leadSuit: Suit, trump: Suit): boolean {
  const aIsTrump = cardA.suit === trump;
  const bIsTrump = cardB.suit === trump;
  const aIsLead = cardA.suit === leadSuit;
  const bIsLead = cardB.suit === leadSuit;

  if (aIsTrump && !bIsTrump) {
    return true;
  }
  if (!aIsTrump && bIsTrump) {
    return false;
  }
  if (aIsTrump && bIsTrump) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }
  if (aIsLead && !bIsLead) {
    return true;
  }
  if (!aIsLead && bIsLead) {
    return false;
  }
  if (cardA.suit === cardB.suit) {
    return CARD_STRENGTH[cardA.rank] > CARD_STRENGTH[cardB.rank];
  }
  return false;
}

/**
 * Get the card currently winning the trick.
 */
function getCurrentWinningCard(trick: Trick, trump: Suit): Card | null {
  if (trick.cards.length === 0) {
    return null;
  }

  let winning = trick.cards[0].card;
  for (let i = 1; i < trick.cards.length; i++) {
    const card = trick.cards[i].card;
    if (cardWouldWin(card, winning, trick.leadSuit!, trump)) {
      winning = card;
    }
  }
  return winning;
}

/**
 * Calculate max meld points across all possible trump suits for a hand.
 */
function calculateMaxMeldPoints(hand: Card[]): { maxPoints: number; bestSuit: Suit } {
  let maxPoints = 0;
  let bestSuit: Suit = 'herz';

  for (const suit of SUITS) {
    const melds = detectMelds(hand, suit);
    const points = calculateMeldPoints(melds);
    if (points > maxPoints) {
      maxPoints = points;
      bestSuit = suit;
    }
  }

  return { maxPoints, bestSuit };
}

/**
 * Choose the best trump suit (highest meld points, ties broken randomly).
 */
function chooseBestTrump(hand: Card[]): Suit {
  const suitPoints: { suit: Suit; points: number }[] = SUITS.map((suit) => ({
    suit,
    points: calculateMeldPoints(detectMelds(hand, suit)),
  }));

  const maxPoints = Math.max(...suitPoints.map((sp) => sp.points));
  const bestSuits = suitPoints.filter((sp) => sp.points === maxPoints);
  return bestSuits[Math.floor(Math.random() * bestSuits.length)].suit;
}

/**
 * Choose cards to discard from hand (after taking dabb).
 * Priority: non-meld cards first, non-trump first, low points first.
 * Never discards aces (10 points) or tens (10 points) that are part of melds.
 */
function chooseCardsToDiscard(hand: Card[], trump: Suit, discardCount: number): CardId[] {
  const melds = detectMelds(hand, trump);
  const meldCardIds = new Set<string>();
  for (const meld of melds) {
    for (const cardId of meld.cards) {
      meldCardIds.add(cardId);
    }
  }

  // Sort cards by discard priority (highest priority = discard first)
  const sorted = [...hand].sort((a, b) => {
    const aIsMeld = meldCardIds.has(a.id) ? 1 : 0;
    const bIsMeld = meldCardIds.has(b.id) ? 1 : 0;
    // Non-meld cards first
    if (aIsMeld !== bIsMeld) {
      return aIsMeld - bIsMeld;
    }

    const aIsTrump = a.suit === trump ? 1 : 0;
    const bIsTrump = b.suit === trump ? 1 : 0;
    // Non-trump cards first
    if (aIsTrump !== bIsTrump) {
      return aIsTrump - bIsTrump;
    }

    // Lower points first
    return RANK_POINTS[a.rank] - RANK_POINTS[b.rank];
  });

  return sorted.slice(0, discardCount).map((c) => c.id);
}

/**
 * Find "lonely" aces — aces where the player has no other card of that suit
 * (excluding the second copy of the same ace).
 */
function findLonelyAces(hand: Card[]): Card[] {
  const lonely: Card[] = [];
  for (const card of hand) {
    if (card.rank !== 'ass') {
      continue;
    }
    const othersOfSuit = hand.filter(
      (c) => c.suit === card.suit && c.id !== card.id && !(c.rank === 'ass' && c.suit === card.suit)
    );
    if (othersOfSuit.length === 0) {
      lonely.push(card);
    }
  }
  return lonely;
}

/**
 * Filter out double aces (both copies of ace in same suit) from a card list,
 * unless they're the only cards of that suit.
 */
function filterDoubleAces(cards: Card[], hand: Card[]): Card[] {
  return cards.filter((card) => {
    if (card.rank !== 'ass') {
      return true;
    }
    const acesOfSuit = hand.filter((c) => c.suit === card.suit && c.rank === 'ass');
    if (acesOfSuit.length < 2) {
      return true;
    }
    // Both aces present — skip unless they're the only cards of this suit
    const allOfSuit = hand.filter((c) => c.suit === card.suit);
    return allOfSuit.length <= 2;
  });
}

export class BinokelAIPlayer implements AIPlayer {
  /** Pre-computed trump suit from dabb phase analysis */
  private precomputedTrump: Suit | null = null;

  async decide(context: AIDecisionContext): Promise<AIAction> {
    const { gameState, playerIndex } = context;

    switch (gameState.phase) {
      case 'bidding':
        return this.decideBidding(context);
      case 'dabb':
        return this.decideDabb(context);
      case 'trump':
        return this.decideTrump(context);
      case 'melding':
        return this.decideMelding(context);
      case 'tricks':
        return this.decideTricks(context);
      default:
        throw new Error(`AI cannot act in phase: ${gameState.phase} (player ${playerIndex})`);
    }
  }

  private decideBidding(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;
    const hand = gameState.hands.get(playerIndex) ?? [];

    try {
      const minBid = getMinBid(gameState.currentBid);
      const canPassNow = canPass(gameState.currentBid);

      // First bid of the round: always bid 150
      if (!canPassNow) {
        return { type: 'bid', amount: minBid };
      }

      // Evaluate hand strength
      const { maxPoints } = calculateMaxMeldPoints(hand);

      // Rough expected total = meld points + estimated trick points (~40-60)
      const estimatedTotal = maxPoints + 50;
      const diff = estimatedTotal - minBid;

      // diff > 0: we estimate we can make the bid
      // diff < 0: the bid exceeds our estimate

      // Comfortable margin: always keep bidding
      if (diff >= 70) {
        return { type: 'bid', amount: minBid };
      }

      // Bid exceeds estimate by a lot: always pass
      if (diff <= -60) {
        return { type: 'pass' };
      }

      // Transition zone (diff from 70 down to -60):
      // Pass probability increases as diff decreases (bid gets riskier)
      // At diff=70: passProb = 0%, at diff=-60: passProb = 90%
      const passProb = Math.min(0.9, Math.pow((70 - diff) / 130, 2) * 0.9);

      if (Math.random() < passProb) {
        return { type: 'pass' };
      }

      return { type: 'bid', amount: minBid };
    } catch {
      // Fallback: pass if possible, otherwise bid minimum
      if (canPass(gameState.currentBid)) {
        return { type: 'pass' };
      }
      return { type: 'bid', amount: getMinBid(gameState.currentBid) };
    }
  }

  private decideDabb(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;
    const hand = gameState.hands.get(playerIndex) ?? [];

    // If dabb hasn't been taken yet, take it
    if (gameState.dabb.length > 0) {
      return { type: 'takeDabb' };
    }

    // Dabb has been taken — need to discard
    try {
      // Pre-compute best trump for later
      this.precomputedTrump = chooseBestTrump(hand);

      const discardCount =
        hand.length - (gameState.playerCount === 2 ? 18 : gameState.playerCount === 3 ? 12 : 9);
      const cardIds = chooseCardsToDiscard(hand, this.precomputedTrump, discardCount);

      return { type: 'discard', cardIds };
    } catch {
      // Fallback: discard last N cards
      const discardCount =
        hand.length - (gameState.playerCount === 2 ? 18 : gameState.playerCount === 3 ? 12 : 9);
      const cardIds = hand.slice(-discardCount).map((c) => c.id);
      return { type: 'discard', cardIds };
    }
  }

  private decideTrump(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;

    try {
      // Use pre-computed trump from dabb phase if available
      if (this.precomputedTrump) {
        const suit = this.precomputedTrump;
        this.precomputedTrump = null;
        return { type: 'declareTrump', suit };
      }

      // Fallback: compute best trump now
      const hand = gameState.hands.get(playerIndex) ?? [];
      const suit = chooseBestTrump(hand);
      return { type: 'declareTrump', suit };
    } catch {
      return { type: 'declareTrump', suit: 'herz' };
    }
  }

  private decideMelding(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;

    try {
      const hand = gameState.hands.get(playerIndex) ?? [];
      const trump = gameState.trump!;
      const melds = detectMelds(hand, trump);

      return { type: 'declareMelds', melds };
    } catch {
      return { type: 'declareMelds', melds: [] };
    }
  }

  private decideTricks(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;

    try {
      const hand = gameState.hands.get(playerIndex) ?? [];
      const trump = gameState.trump!;
      const trick = gameState.currentTrick;
      const validPlays = getValidPlays(hand, trick, trump);

      if (validPlays.length === 1) {
        return { type: 'playCard', cardId: validPlays[0].id };
      }

      // Leading (first card of trick)
      if (trick.cards.length === 0) {
        return this.decideLeadCard(validPlays, hand, trump);
      }

      // Following
      return this.decideFollowCard(validPlays, hand, trick, trump);
    } catch {
      // Fallback: play first valid card
      const hand = gameState.hands.get(playerIndex) ?? [];
      const trump = gameState.trump ?? 'herz';
      const trick = gameState.currentTrick;
      const validPlays = getValidPlays(hand, trick, trump);
      return { type: 'playCard', cardId: validPlays[0].id };
    }
  }

  /**
   * Choose a card to lead with (first card of a trick).
   *
   * Priority:
   * 1. Lonely aces (trump suit preferred)
   * 2. General lead: prefer trump if >3 trump cards, else non-trump;
   *    higher points preferred; skip double aces unless only cards of suit.
   */
  private decideLeadCard(validPlays: Card[], hand: Card[], trump: Suit): AIAction {
    // 1. Try lonely aces first
    const lonelyAces = findLonelyAces(hand).filter((a) => validPlays.some((v) => v.id === a.id));
    if (lonelyAces.length > 0) {
      // Prefer trump aces
      const trumpAce = lonelyAces.find((a) => a.suit === trump);
      if (trumpAce) {
        return { type: 'playCard', cardId: trumpAce.id };
      }
      return { type: 'playCard', cardId: lonelyAces[0].id };
    }

    // 2. General lead
    const trumpCards = hand.filter((c) => c.suit === trump);
    const useTrump = trumpCards.length > 3;

    // Filter candidates by trump/non-trump preference
    let candidates = useTrump
      ? validPlays.filter((c) => c.suit === trump)
      : validPlays.filter((c) => c.suit !== trump);

    // Fallback to all valid plays if filter removed everything
    if (candidates.length === 0) {
      candidates = validPlays;
    }

    // Filter out double aces (save them)
    const filtered = filterDoubleAces(candidates, hand);
    if (filtered.length > 0) {
      candidates = filtered;
    }

    // Sort by points descending (prefer high-value leads)
    candidates.sort((a, b) => RANK_POINTS[b.rank] - RANK_POINTS[a.rank]);

    return { type: 'playCard', cardId: candidates[0].id };
  }

  /**
   * Choose a card when following (not leading).
   *
   * Strategy:
   * - If we can win: play lowest winning card
   * - If we can't win: play lowest card from suit with most cards, preferring non-trump
   */
  private decideFollowCard(validPlays: Card[], hand: Card[], trick: Trick, trump: Suit): AIAction {
    const winningCard = getCurrentWinningCard(trick, trump);
    if (!winningCard) {
      return { type: 'playCard', cardId: validPlays[0].id };
    }

    const leadSuit = trick.leadSuit!;

    // Find cards that would win the trick
    const winningPlays = validPlays.filter((c) => cardWouldWin(c, winningCard, leadSuit, trump));

    if (winningPlays.length > 0) {
      // Play lowest winning card (save high cards)
      winningPlays.sort((a, b) => {
        // Sort by strength ascending
        const strengthDiff = CARD_STRENGTH[a.rank] - CARD_STRENGTH[b.rank];
        if (strengthDiff !== 0) {
          return strengthDiff;
        }
        // Tie-break by points ascending
        return RANK_POINTS[a.rank] - RANK_POINTS[b.rank];
      });
      return { type: 'playCard', cardId: winningPlays[0].id };
    }

    // Can't win — dump cheapest card
    // Prefer non-trump cards, then cards from suits with most remaining cards
    const nonTrump = validPlays.filter((c) => c.suit !== trump);
    const dumpCandidates = nonTrump.length > 0 ? nonTrump : validPlays;

    // Count cards per suit in hand for each candidate suit
    dumpCandidates.sort((a, b) => {
      // Prefer suits with more cards (we can afford to lose one)
      const aCount = hand.filter((c) => c.suit === a.suit).length;
      const bCount = hand.filter((c) => c.suit === b.suit).length;
      if (aCount !== bCount) {
        return bCount - aCount;
      }
      // Then lowest points
      return RANK_POINTS[a.rank] - RANK_POINTS[b.rank];
    });

    return { type: 'playCard', cardId: dumpCandidates[0].id };
  }
}
