/**
 * Binokel AI Player implementation
 *
 * Supports easy/medium/hard difficulty via mistakeProbability:
 *   hard (0):   optimal play — smearing safety, card-counting leads, endgame squeeze
 *   medium (0.15): occasional mistakes
 *   easy (0.35): frequent mistakes
 *
 * On easy and medium a rubber band raises that rate while the AI is ahead (see
 * effectiveMistakeProbability). The base rate stays the floor — the band only ever makes the
 * AI worse, never better than the difficulty the player chose.
 *
 * See docs/AI_STRATEGY.md for human-readable strategy documentation.
 */

import type {
  AIAction,
  AIDecisionContext,
  Card,
  CardId,
  GameState,
  PlayedCard,
  PlayerIndex,
  Suit,
  Team,
  Trick,
} from '@dabb/shared-types';
import { CARDS_PER_PLAYER, RANK_POINTS, SUITS } from '@dabb/shared-types';
import {
  calculateMeldPoints,
  canPass,
  CARD_STRENGTH,
  cardBeats,
  detectMelds,
  getMinBid,
  getPartnerIndex,
  getValidPlays,
  isPartnerWinning,
} from '@dabb/game-logic';

import type { AIPlayer, AIStrategy } from './AIPlayer.js';

/**
 * Score lead at which the rubber band is fully applied. Roughly one strong round on the
 * default target of 1000.
 */
export const RUBBER_BAND_SPAN = 200;

/**
 * The mistake rate this AI plays at right now: the base rate of its difficulty, plus up to
 * `strength` more while it is ahead of the best other side.
 *
 * Only ever adds. Being behind restores the picked difficulty and no more — an easy bot never
 * turns into a hard one because the human is winning.
 *
 * `totalScores` only moves when a round is scored, so the rate holds steady for a whole round
 * instead of drifting between two cards of the same trick.
 */
export function effectiveMistakeProbability(
  base: number,
  strength: number,
  state: GameState,
  playerIndex: PlayerIndex
): number {
  if (strength <= 0) {
    return base;
  }
  // 4-player scores are keyed by Team, everything else by PlayerIndex — and team 0/1 collide
  // numerically with seats 0/1, so the branch has to happen before any lookup.
  const isTeamGame = state.playerCount === 4;
  const myKey: PlayerIndex | Team = isTeamGame ? ((playerIndex % 2) as Team) : playerIndex;

  let bestOther = 0;
  let sawOther = false;
  for (const [key, score] of state.totalScores) {
    if (key === myKey) {
      continue;
    }
    if (!sawOther || score > bestOther) {
      bestOther = score;
      sawOther = true;
    }
  }
  if (!sawOther) {
    return base;
  }

  const myScore = state.totalScores.get(myKey) ?? 0;
  const lead = Math.min(1, Math.max(0, (myScore - bestOther) / RUBBER_BAND_SPAN));
  return base + strength * lead;
}

// ---- Card comparison helpers ----

/**
 * `cardBeats` under its old local name. Both the strength table and this comparison used to be
 * copied into this file; they now come from the rules engine, so the AI cannot disagree with it
 * about who wins a trick.
 */
const cardWouldWin = cardBeats;

function getCurrentWinningPlay(trick: Trick, trump: Suit): PlayedCard | null {
  if (trick.cards.length === 0) {
    return null;
  }
  let winning = trick.cards[0];
  for (let i = 1; i < trick.cards.length; i++) {
    const played = trick.cards[i];
    if (cardWouldWin(played.card, winning.card, trick.leadSuit!, trump)) {
      winning = played;
    }
  }
  return winning;
}

// ---- Card knowledge helpers ----

/**
 * Collect all card IDs that are no longer in any hand
 * (already played in completed tricks or currently on the table).
 */
function buildPlayedCardIds(state: GameState): Set<string> {
  const played = new Set<string>();
  // Completed tricks (tricksTaken stores Card[][] per player)
  state.tricksTaken.forEach((tricks) => {
    for (const trick of tricks) {
      for (const card of trick) {
        played.add(card.id);
      }
    }
  });
  // Current trick
  for (const pc of state.currentTrick.cards) {
    played.add(pc.card.id);
  }
  return played;
}

/**
 * Count aces of a given suit that remain in opponents' hands.
 * = (total copies in deck) - (in our hand) - (already played)
 */
function countRemainingOpponentAces(suit: Suit, hand: Card[], playedIds: Set<string>): number {
  const totalAces = 2; // 2 copies of each card in the deck
  const myAces = hand.filter((c) => c.suit === suit && c.rank === 'ass').length;
  const playedAces = Array.from(playedIds).filter((id) => id.startsWith(`${suit}-ass`)).length;
  return Math.max(0, totalAces - myAces - playedAces);
}

/**
 * Get the partner's PlayerIndex in 4-player games, or null otherwise.
 */
function getPartner(playerIndex: PlayerIndex, state: GameState): PlayerIndex | null {
  if (state.playerCount !== 4) {
    return null;
  }
  return getPartnerIndex(state.players, playerIndex);
}

// ---- Trump / Meld helpers ----

/**
 * Estimate trick points based on trump count and hand composition.
 * @param hand - current hand
 * @param trump - proposed trump suit
 * @param playerCount - number of players (more players = more competition)
 */
function estimateTrickPoints(hand: Card[], trump: Suit, playerCount: number): number {
  const trumpCount = hand.filter((c) => c.suit === trump).length;

  // Base estimate by trump count
  const BASE: Record<number, number> = { 0: 20, 1: 30, 2: 40, 3: 55, 4: 65, 5: 75 };
  let estimate = trumpCount >= 6 ? 85 : (BASE[trumpCount] ?? 20);

  // Bonus +10 for each non-trump lonely ace (only card of that suit in hand)
  for (const card of hand) {
    if (card.rank !== 'ass') {
      continue;
    }
    if (card.suit === trump) {
      continue;
    }
    const othersOfSuit = hand.filter((c) => c.suit === card.suit && c.id !== card.id);
    if (othersOfSuit.length === 0) {
      estimate += 10;
    }
  }

  // Bonus +5 for each non-trump ten where only 1 card of that suit remains
  for (const card of hand) {
    if (card.rank !== '10') {
      continue;
    }
    if (card.suit === trump) {
      continue;
    }
    const ofSuit = hand.filter((c) => c.suit === card.suit);
    if (ofSuit.length === 1) {
      estimate += 5;
    }
  }

  // Scale down slightly for more players (more competition for tricks)
  if (playerCount >= 3) {
    estimate = Math.round(estimate * 0.85);
  }

  return Math.min(estimate, 100);
}

/**
 * Evaluate the best trump suit using combined meld + trick estimate.
 * Tiebreaker: prefer suit with more trump cards in hand.
 * Score = meldPoints * 100 + trumpCount
 */
function evaluateBestSuit(
  hand: Card[],
  playerCount: number
): { meldPoints: number; bestSuit: Suit; estimatedTotal: number } {
  let bestSuit: Suit = 'herz';
  let bestScore = -1;
  let bestMeld = 0;

  for (const suit of SUITS) {
    const melds = detectMelds(hand, suit);
    const meldPoints = calculateMeldPoints(melds);
    const trumpCount = hand.filter((c) => c.suit === suit).length;
    const score = meldPoints * 100 + trumpCount;
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
      bestMeld = meldPoints;
    }
  }

  const trickEstimate = estimateTrickPoints(hand, bestSuit, playerCount);
  return { meldPoints: bestMeld, bestSuit, estimatedTotal: bestMeld + trickEstimate };
}

// ---- Discard helper ----

/**
 * Choose cards to discard strategically, favouring void creation.
 *
 * Scoring (lower = discard first):
 * - Meld cards: +10000 (strongly avoid discarding)
 * - Trump cards: +5000 (avoid discarding trump)
 * - Rank points * 100 (prefer discarding low-value cards)
 * - Void creation bonus: -2000 if last non-meld card of suit, -500 if second-to-last
 */
function chooseCardsToDiscardStrategic(hand: Card[], trump: Suit, discardCount: number): CardId[] {
  const melds = detectMelds(hand, trump);
  const meldCardIds = new Set<string>();
  for (const meld of melds) {
    for (const cardId of meld.cards) {
      meldCardIds.add(cardId);
    }
  }

  const scored = hand.map((card) => {
    let score = 0;
    if (meldCardIds.has(card.id)) {
      score += 10000;
    }
    if (card.suit === trump) {
      score += 5000;
    }
    score += RANK_POINTS[card.rank] * 100;

    // Void creation bonus: count non-meld cards of this suit
    const nonMeldOfSuit = hand.filter((c) => c.suit === card.suit && !meldCardIds.has(c.id)).length;
    if (nonMeldOfSuit === 1) {
      // Last non-meld card of suit — discarding creates a void
      score -= 2000;
    } else if (nonMeldOfSuit === 2) {
      // Second-to-last non-meld — partial void bonus
      score -= 500;
    }

    return { card, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, discardCount).map((s) => s.card.id);
}

// ---- Lonely ace helpers ----

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

function filterDoubleAces(cards: Card[], hand: Card[]): Card[] {
  return cards.filter((card) => {
    if (card.rank !== 'ass') {
      return true;
    }
    const acesOfSuit = hand.filter((c) => c.suit === card.suit && c.rank === 'ass');
    if (acesOfSuit.length < 2) {
      return true;
    }
    const allOfSuit = hand.filter((c) => c.suit === card.suit);
    return allOfSuit.length <= 2;
  });
}

// ---- The AI class ----

export class BinokelAIPlayer implements AIPlayer {
  private readonly mistakeProbability: number;
  private readonly rubberBandStrength: number;
  /** Mistake rate for the decision in flight, recomputed once per decide() */
  private currentMistakeProbability: number;
  /** Round number when instance state was last reset */
  private lastSeenRound: number = -1;
  /**
   * Tracks which players are known void in which suits,
   * detected from lastCompletedTrick (accumulates across tricks).
   */
  private voidPlayers: Map<PlayerIndex, Set<Suit>> = new Map();

  /** Trick-play generation. Nothing branches on it yet — see AIStrategy. */
  protected readonly strategy: AIStrategy;

  constructor(
    mistakeProbability: number = 0,
    rubberBandStrength: number = 0,
    strategy: AIStrategy = 1
  ) {
    this.mistakeProbability = mistakeProbability;
    this.rubberBandStrength = rubberBandStrength;
    this.currentMistakeProbability = mistakeProbability;
    this.strategy = strategy;
  }

  /**
   * Randomly replace the optimal choice with an alternative to simulate mistakes.
   * Only triggers when the current mistake rate is > 0 and alternatives exist.
   */
  private maybeBlunder<T>(optimal: T, alternatives: T[]): T {
    if (
      this.currentMistakeProbability > 0 &&
      alternatives.length > 0 &&
      Math.random() < this.currentMistakeProbability
    ) {
      return alternatives[Math.floor(Math.random() * alternatives.length)];
    }
    return optimal;
  }

  async decide(context: AIDecisionContext): Promise<AIAction> {
    const { gameState, playerIndex } = context;

    this.currentMistakeProbability = effectiveMistakeProbability(
      this.mistakeProbability,
      this.rubberBandStrength,
      gameState,
      playerIndex
    );

    // Reset per-round state when a new round starts
    if (gameState.round !== this.lastSeenRound) {
      this.lastSeenRound = gameState.round;
      this.voidPlayers = new Map();
    }

    switch (gameState.phase) {
      case 'bidding':
        return this.decideBidding(context);
      case 'dabb':
        return { type: 'takeDabb' };
      case 'trump':
        return this.decideTrump(context);
      case 'discard':
        return this.decideDiscard(context);
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

      // First bid — must bid minimum, no blunder possible
      if (!canPassNow) {
        return { type: 'bid', amount: minBid };
      }

      // Evaluate best suit and estimate total score
      const { meldPoints, bestSuit } = evaluateBestSuit(hand, gameState.playerCount);
      const estimatedTotal =
        meldPoints + estimateTrickPoints(hand, bestSuit, gameState.playerCount);
      const diff = estimatedTotal - minBid;

      // Team-aware: if the current bid was set by our teammate, only outbid them when our hand
      // is clearly strong enough (diff >= 60) — otherwise pass to honour their bid.
      const partnerIndex = getPartner(playerIndex, gameState);
      const biddingAgainstPartner =
        partnerIndex !== null && gameState.lastBidderIndex === partnerIndex;
      if (biddingAgainstPartner) {
        return diff >= 60 ? { type: 'bid', amount: minBid } : { type: 'pass' };
      }

      let optimal: AIAction;

      // Comfortable margin: always bid
      if (diff >= 60) {
        optimal = { type: 'bid', amount: minBid };
      } else if (diff <= -50) {
        // Clearly hopeless: always pass
        optimal = { type: 'pass' };
      } else {
        // Linear pass probability in [-50, 60] range
        // At diff=60: passProb=0%, at diff=-50: passProb=85%
        const passProb = Math.min(0.85, (60 - diff) / 110);
        optimal = Math.random() < passProb ? { type: 'pass' } : { type: 'bid', amount: minBid };
      }

      const alternative: AIAction =
        optimal.type === 'bid' ? { type: 'pass' } : { type: 'bid', amount: minBid };
      return this.maybeBlunder(optimal, [alternative]);
    } catch {
      if (canPass(gameState.currentBid)) {
        return { type: 'pass' };
      }
      return { type: 'bid', amount: getMinBid(gameState.currentBid) };
    }
  }

  /**
   * Lay four cards away, or go out if the hand can't carry the bid.
   *
   * Trump is already declared by this point, so the discard is scored against the real trump
   * rather than a guess — and any trump that still gets buried is announced to the table.
   */
  private decideDiscard(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;
    const hand = gameState.hands.get(playerIndex) ?? [];
    const trump = gameState.trump ?? 'herz';
    const discardCount = hand.length - CARDS_PER_PLAYER[gameState.playerCount];

    try {
      const meldPoints = calculateMeldPoints(detectMelds(hand, trump));
      const estimatedTotal = meldPoints + estimateTrickPoints(hand, trump, gameState.playerCount);
      const currentBid = gameState.currentBid || 150;

      if (estimatedTotal < currentBid * 0.7) {
        // Hand too weak — go out
        return { type: 'goOut' };
      }

      const cardIds = chooseCardsToDiscardStrategic(hand, trump, discardCount);

      const optimalDiscard: AIAction = { type: 'discard', cardIds };
      const shuffledHand = [...hand].sort(() => Math.random() - 0.5);
      const alternativeDiscard: AIAction = {
        type: 'discard',
        cardIds: shuffledHand.slice(0, discardCount).map((c) => c.id),
      };
      return this.maybeBlunder(optimalDiscard, [alternativeDiscard]);
    } catch {
      // Fallback: discard last N cards
      return { type: 'discard', cardIds: hand.slice(-discardCount).map((c) => c.id) };
    }
  }

  private decideTrump(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;

    try {
      const hand = gameState.hands.get(playerIndex) ?? [];
      const bestSuit = evaluateBestSuit(hand, gameState.playerCount).bestSuit;
      const otherSuits = SUITS.filter((s) => s !== bestSuit);
      return { type: 'declareTrump', suit: this.maybeBlunder(bestSuit, otherSuits) };
    } catch {
      return { type: 'declareTrump', suit: 'herz' };
    }
  }

  private decideMelding(_context: AIDecisionContext): AIAction {
    // Melding offers no choice — every meld in the hand is always declared, and the engine
    // derives them itself. Nothing left to decide.
    return { type: 'declareMelds' };
  }

  private decideTricks(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;

    try {
      const hand = gameState.hands.get(playerIndex) ?? [];
      const trump = gameState.trump!;
      const trick = gameState.currentTrick;
      const validPlays = getValidPlays(
        hand,
        trick,
        trump,
        isPartnerWinning(trick, trump, playerIndex, gameState.players)
      );

      if (validPlays.length === 1) {
        return { type: 'playCard', cardId: validPlays[0].id };
      }

      // Update void knowledge from last completed trick
      this.updateVoidKnowledge(gameState, trump);

      const playedIds = buildPlayedCardIds(gameState);

      // Get optimal card from lead/follow logic
      const cardAction =
        trick.cards.length === 0
          ? this.decideLeadCard(validPlays, hand, trump, playerIndex, gameState, playedIds)
          : this.decideFollowCard(validPlays, hand, trick, trump, playerIndex, gameState);

      // decideLeadCard / decideFollowCard always return playCard
      if (cardAction.type !== 'playCard') {
        return cardAction;
      }
      const optimalCardId = cardAction.cardId;

      // Apply blunder: randomly play a different valid card
      const alternatives = validPlays
        .filter((c) => c.id !== optimalCardId)
        .map((c) => c.id as CardId);
      return {
        type: 'playCard',
        cardId: this.maybeBlunder(optimalCardId, alternatives),
      };
    } catch {
      const hand = gameState.hands.get(playerIndex) ?? [];
      const trump = gameState.trump ?? 'herz';
      const trick = gameState.currentTrick;
      const validPlays = getValidPlays(
        hand,
        trick,
        trump,
        isPartnerWinning(trick, trump, playerIndex, gameState.players)
      );
      return { type: 'playCard', cardId: validPlays[0].id };
    }
  }

  /**
   * Update void knowledge from the most recently completed trick.
   * If a player played neither the lead suit nor trump, they are void in the lead suit.
   */
  private updateVoidKnowledge(state: GameState, trump: Suit): void {
    const lastTrick = state.lastCompletedTrick;
    if (!lastTrick || lastTrick.cards.length === 0) {
      return;
    }
    // It survives the round reset for the trick animation, so a trick from the previous round
    // would otherwise mark voids against the new round's hands and trump.
    if (lastTrick.round !== state.round) {
      return;
    }

    // Lead suit is inferred from the first card played
    const leadSuit = lastTrick.cards[0].card.suit;

    for (const playedCard of lastTrick.cards) {
      const { playerIndex, card } = playedCard;
      if (card.suit !== leadSuit && card.suit !== trump) {
        // Player couldn't follow suit and couldn't/didn't trump → void in lead suit
        if (!this.voidPlayers.has(playerIndex)) {
          this.voidPlayers.set(playerIndex, new Set());
        }
        this.voidPlayers.get(playerIndex)!.add(leadSuit);
      }
    }
  }

  /**
   * Choose a card to lead with (first card of a trick).
   *
   * Priority:
   * 1. Lonely aces (trump preferred)
   * 2. Trump exhaustion (bid winner with 3+ trump, opponents still have trump)
   * 3. Endgame squeeze (last 3 tricks: lead trump to squeeze opponents)
   * 4. Card-counting lead (prefer suits where no opponent aces remain)
   * 5. General lead (trump if >3, else non-trump; high points; skip double aces)
   */
  private decideLeadCard(
    validPlays: Card[],
    hand: Card[],
    trump: Suit,
    playerIndex: PlayerIndex,
    state: GameState,
    playedIds: Set<string>
  ): AIAction {
    // 1. Lonely aces first
    const lonelyAces = findLonelyAces(hand).filter((a) => validPlays.some((v) => v.id === a.id));
    if (lonelyAces.length > 0) {
      const trumpAce = lonelyAces.find((a) => a.suit === trump);
      if (trumpAce) {
        return { type: 'playCard', cardId: trumpAce.id };
      }
      return { type: 'playCard', cardId: lonelyAces[0].id };
    }

    // 2. Trump exhaustion: bid winner with 3+ trump leads highest trump
    if (state.bidWinner === playerIndex) {
      const trumpInHand = hand.filter((c) => c.suit === trump);
      if (trumpInHand.length >= 3) {
        // 10 trump per suit in the deck (5 ranks × 2 copies)
        const playedTrump = Array.from(playedIds).filter((id) => id.startsWith(`${trump}-`)).length;
        const remainingOpponentTrump = 10 - trumpInHand.length - playedTrump;
        if (remainingOpponentTrump > 0) {
          const trumpPlays = validPlays.filter((c) => c.suit === trump);
          if (trumpPlays.length > 0) {
            trumpPlays.sort((a, b) => CARD_STRENGTH[b.rank] - CARD_STRENGTH[a.rank]);
            return { type: 'playCard', cardId: trumpPlays[0].id };
          }
        }
      }
    }

    // 3. Endgame squeeze: in last 3 tricks, lead trump to collect late-game points
    if (hand.length <= 3) {
      const trumpPlays = validPlays.filter((c) => c.suit === trump);
      if (trumpPlays.length > 0) {
        trumpPlays.sort((a, b) => CARD_STRENGTH[b.rank] - CARD_STRENGTH[a.rank]);
        return { type: 'playCard', cardId: trumpPlays[0].id };
      }
    }

    // 4. Card-counting lead: prefer suits where no opponent aces remain
    const safeNonTrumpPlays = validPlays.filter(
      (c) => c.suit !== trump && countRemainingOpponentAces(c.suit, hand, playedIds) === 0
    );
    if (safeNonTrumpPlays.length > 0) {
      const filtered = filterDoubleAces(safeNonTrumpPlays, hand);
      const candidates = filtered.length > 0 ? filtered : safeNonTrumpPlays;
      candidates.sort((a, b) => RANK_POINTS[b.rank] - RANK_POINTS[a.rank]);
      return { type: 'playCard', cardId: candidates[0].id };
    }

    // 5. General lead
    const trumpCards = hand.filter((c) => c.suit === trump);
    const useTrump = trumpCards.length > 3;

    let candidates = useTrump
      ? validPlays.filter((c) => c.suit === trump)
      : validPlays.filter((c) => c.suit !== trump);

    if (candidates.length === 0) {
      candidates = validPlays;
    }

    const filtered = filterDoubleAces(candidates, hand);
    if (filtered.length > 0) {
      candidates = filtered;
    }

    candidates.sort((a, b) => RANK_POINTS[b.rank] - RANK_POINTS[a.rank]);
    return { type: 'playCard', cardId: candidates[0].id };
  }

  /**
   * Choose a card when following (not leading).
   *
   * Priority:
   * 1. Smearing — 4-player only: partner winning AND we are last to play
   * 2. Win with minimum card
   * 3. Void creation — prefer discarding last card of a suit to create a void
   * 4. Dump lowest card (from suit with most cards, non-trump preferred)
   */
  private decideFollowCard(
    validPlays: Card[],
    hand: Card[],
    trick: Trick,
    trump: Suit,
    playerIndex: PlayerIndex,
    state: GameState
  ): AIAction {
    const winningPlay = getCurrentWinningPlay(trick, trump);
    if (!winningPlay) {
      return { type: 'playCard', cardId: validPlays[0].id };
    }
    const winningCard = winningPlay.card;

    const leadSuit = trick.leadSuit!;
    const partner = getPartner(playerIndex, state);
    // Derived from the cards on the table — `trick.winnerIndex` is only ever set on a
    // completed trick, so the in-progress trick always carries null there.
    const partnerIsWinning = partner !== null && winningPlay.playerIndex === partner;

    // Find cards that would win the trick
    const winningPlays = validPlays.filter((c) => cardWouldWin(c, winningCard, leadSuit, trump));

    // 1. Smearing (4-player only): partner is winning AND we are last to play, so the trick
    //    is already safe. Safety: only smear when no opponent can steal the trick after us.
    //    The partner exemption lets us duck even when we could overtake, so pick the most
    //    valuable card that does *not* beat the partner — banking its points while keeping
    //    our high cards. If every legal card would overtake, fall through and win cheaply.
    const isLastToPlay = trick.cards.length === state.playerCount - 1;
    if (partnerIsWinning && isLastToPlay) {
      const ducking = validPlays.filter((c) => !cardWouldWin(c, winningCard, leadSuit, trump));
      if (ducking.length > 0) {
        const nonTrump = ducking.filter((c) => c.suit !== trump);
        const smearCandidates = nonTrump.length > 0 ? nonTrump : ducking;
        smearCandidates.sort((a, b) => RANK_POINTS[b.rank] - RANK_POINTS[a.rank]);
        return { type: 'playCard', cardId: smearCandidates[0].id };
      }
    }

    // 2. Win with minimum card
    if (winningPlays.length > 0) {
      winningPlays.sort((a, b) => {
        const strengthDiff = CARD_STRENGTH[a.rank] - CARD_STRENGTH[b.rank];
        if (strengthDiff !== 0) {
          return strengthDiff;
        }
        return RANK_POINTS[a.rank] - RANK_POINTS[b.rank];
      });
      return { type: 'playCard', cardId: winningPlays[0].id };
    }

    // Can't win
    const nonTrump = validPlays.filter((c) => c.suit !== trump);
    const dumpCandidates = nonTrump.length > 0 ? nonTrump : validPlays;

    // 3. Void creation: prefer discarding last card of a suit to enable future trumping
    const voidCreators = dumpCandidates.filter((c) => {
      const suitCount = hand.filter((h) => h.suit === c.suit).length;
      return suitCount === 1;
    });

    if (voidCreators.length > 0) {
      voidCreators.sort((a, b) => RANK_POINTS[a.rank] - RANK_POINTS[b.rank]);
      return { type: 'playCard', cardId: voidCreators[0].id };
    }

    // 4. Dump lowest (prefer suits with most cards, then lowest points)
    dumpCandidates.sort((a, b) => {
      const aCount = hand.filter((c) => c.suit === a.suit).length;
      const bCount = hand.filter((c) => c.suit === b.suit).length;
      if (aCount !== bCount) {
        return bCount - aCount;
      }
      return RANK_POINTS[a.rank] - RANK_POINTS[b.rank];
    });

    return { type: 'playCard', cardId: dumpCandidates[0].id };
  }
}
