/**
 * Turning a player's action into the events it produces.
 *
 * Every action is validated against the state it claims to act on and then expanded into
 * its full cascade — a card play can finish a trick, a round and the whole game. All three
 * engines (the online client, offline play and the simulation) go through here, so a move
 * is legal, and scores the same, wherever it was made.
 *
 * This has no transport in it. Where the events end up — Firebase, memory, a result file —
 * is the caller's business.
 */

import type {
  AIAction,
  Card,
  CardId,
  GameEvent,
  GameState,
  PlayerCount,
  PlayerIndex,
  Suit,
  Team,
} from '@dabb/shared-types';
import { DABB_SIZE, GameError, GAME_ERROR_CODES } from '@dabb/shared-types';

import { applyEvent } from '../state/reducer.js';
import { calculateMeldPoints, detectMelds } from '../melds/index.js';
import {
  calculateTrickPoints,
  canPass,
  determineTrickWinner,
  getBiddingWinner,
  isBiddingComplete,
  isPartnerWinning,
  isValidBid,
  isValidPlay,
} from '../phases/index.js';
import {
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createGameStartedEvent,
  createGameTerminatedEvent,
  createGoingOutEvent,
  createMeldingCompleteEvent,
  createMeldsDeclaredEvent,
  createPlayerJoinedEvent,
  createPlayerPassedEvent,
  createTrickWonEvent,
  createTrumpDeclaredEvent,
} from '../events/index.js';
import { createDealEvent } from './deal.js';
import { createGoingOutScoreEvents, createRoundEndEvents } from './scoring.js';
import type { NextContext } from './context.js';

/** A seat at the table, as the lobby knows it before the game starts. */
export interface PlayerInfo {
  playerIndex: PlayerIndex;
  nickname: string;
  isAI: boolean;
  team: Team | null;
}

export function createStartGameEvents(
  next: NextContext,
  players: PlayerInfo[],
  playerCount: PlayerCount,
  targetScore: number
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const player of players) {
    // 4-player: partners sit opposite each other, so seat parity decides the team
    const team = playerCount === 4 ? ((player.playerIndex % 2) as Team) : player.team;
    events.push(
      createPlayerJoinedEvent(
        next(),
        `player-${player.playerIndex}`,
        player.playerIndex,
        player.nickname,
        team ?? undefined
      )
    );
  }

  const initialDealer = (playerCount - 1) as PlayerIndex;
  events.push(createGameStartedEvent(next(), playerCount, targetScore, initialDealer));
  events.push(createDealEvent(next, playerCount));

  return events;
}

export function createBidPlacedEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  amount: number,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'bidding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }
  if (state.currentBidder !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN_TO_BID);
  }
  if (!isValidBid(amount, state.currentBid)) {
    throw new GameError(GAME_ERROR_CODES.INVALID_BID_AMOUNT);
  }
  return [createBidPlacedEvent(next(), playerIndex, amount)];
}

export function createPlayerPassedEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'bidding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }
  if (state.currentBidder !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN);
  }
  if (!canPass(state.currentBid)) {
    throw new GameError(GAME_ERROR_CODES.FIRST_BIDDER_MUST_BID);
  }

  const events: GameEvent[] = [createPlayerPassedEvent(next(), playerIndex)];

  const newPassedPlayers = new Set(state.passedPlayers);
  newPassedPlayers.add(playerIndex);

  if (isBiddingComplete(state.playerCount, newPassedPlayers)) {
    const winner = getBiddingWinner(state.playerCount, newPassedPlayers);
    if (winner !== null) {
      events.push(createBiddingWonEvent(next(), winner, state.currentBid || 150, state.dabb));
    }
  }

  return events;
}

export function createTakeDabbEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'dabb') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
  }
  return [createDabbTakenEvent(next(), playerIndex, state.dabb)];
}

export function createDeclareTrumpEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  suit: Suit,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'trump') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_TRUMP_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
  }
  return [createTrumpDeclaredEvent(next(), playerIndex, suit)];
}

export function createDiscardCardsEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  cardIds: CardId[],
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'discard') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_DISCARD);
  }

  const dabbSize = DABB_SIZE[state.playerCount];
  // Distinct, not just four entries: the same id four times passed the count and the
  // in-hand check, and the reducer then trimmed three unrelated cards off the front of the
  // hand (its placeholder-shortfall path) while only one card reached the layaway.
  if (cardIds.length !== dabbSize || new Set(cardIds).size !== dabbSize) {
    throw new GameError(GAME_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: dabbSize });
  }

  const hand = state.hands.get(playerIndex) ?? [];
  const handIds = new Set(hand.map((c) => c.id));
  for (const cardId of cardIds) {
    if (!handIds.has(cardId)) {
      throw new GameError(GAME_ERROR_CODES.CARD_NOT_IN_HAND);
    }
  }

  return [createCardsDiscardedEvent(next(), playerIndex, cardIds)];
}

/** Going out replaces the layaway, so it happens in the discard phase with trump already set. */
export function createGoOutEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'discard') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_GO_OUT);
  }
  if (state.dabb.length > 0) {
    throw new GameError(GAME_ERROR_CODES.MUST_TAKE_DABB_BEFORE_GOING_OUT);
  }
  return [createGoingOutEvent(next(), playerIndex, state.trump!)];
}

/**
 * Melds are derived here from the player's own hand rather than accepted from the caller —
 * the UI and the AI both declare every meld they hold, so a caller-supplied list could only
 * ever disagree with the hand it claims to describe.
 */
export function createDeclareMeldsEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'melding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_MELDING_PHASE);
  }
  if (state.wentOut && playerIndex === state.bidWinner) {
    throw new GameError(GAME_ERROR_CODES.CANNOT_MELD_WHEN_GOING_OUT);
  }
  if (state.declaredMelds.has(playerIndex)) {
    throw new GameError(GAME_ERROR_CODES.ALREADY_DECLARED_MELDS);
  }

  const melds = detectMelds(state.hands.get(playerIndex) ?? [], state.trump!);
  const totalPoints = calculateMeldPoints(melds);
  const events: GameEvent[] = [createMeldsDeclaredEvent(next(), playerIndex, melds, totalPoints)];

  const expectedMeldCount = state.wentOut ? state.playerCount - 1 : state.playerCount;
  if (state.declaredMelds.size + 1 !== expectedMeldCount) {
    return events;
  }

  const meldScores = {} as Record<PlayerIndex, number>;
  state.declaredMelds.forEach((m, idx) => {
    meldScores[idx] = calculateMeldPoints(m);
  });
  meldScores[playerIndex] = totalPoints;

  if (!state.wentOut) {
    events.push(createMeldingCompleteEvent(next(), meldScores));
    return events;
  }

  // A bid winner who went out scores no melds of their own.
  meldScores[state.bidWinner!] = 0;
  events.push(createMeldingCompleteEvent(next(), meldScores));
  events.push(...createGoingOutScoreEvents(state, meldScores, next));
  return events;
}

export function createPlayCardEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  cardId: CardId,
  next: NextContext
): GameEvent[] {
  if (state.phase !== 'tricks') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_TRICKS_PHASE);
  }
  if (state.currentPlayer !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN);
  }

  const hand = state.hands.get(playerIndex) ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    throw new GameError(GAME_ERROR_CODES.CARD_NOT_IN_HAND);
  }
  const partnerWinning = isPartnerWinning(
    state.currentTrick,
    state.trump!,
    playerIndex,
    state.players
  );
  if (!isValidPlay(card, hand, state.currentTrick, state.trump!, partnerWinning)) {
    throw new GameError(GAME_ERROR_CODES.INVALID_PLAY);
  }

  const events: GameEvent[] = [createCardPlayedEvent(next(), playerIndex, card)];

  if (state.currentTrick.cards.length + 1 !== state.playerCount) {
    return events;
  }

  const completedTrick = {
    cards: [...state.currentTrick.cards, { cardId: card.id, card, playerIndex }],
    leadSuit: state.currentTrick.leadSuit || card.suit,
    winnerIndex: null,
  };
  const winnerIdx = determineTrickWinner(completedTrick, state.trump!);
  const trickCards = completedTrick.cards.map((pc: { card: Card }) => pc.card);
  events.push(
    createTrickWonEvent(
      next(),
      completedTrick.cards[winnerIdx].playerIndex,
      trickCards,
      calculateTrickPoints(trickCards)
    )
  );

  const remainingCards = hand.length - 1;
  if (remainingCards === 0) {
    // Score against the state the trick left behind, not the one the play started from.
    const scoringState = events.reduce((s, event) => applyEvent(s, event), state);
    events.push(...createRoundEndEvents(scoringState, next));
  }

  return events;
}

export function createTerminateGameEvents(
  state: GameState,
  playerIndex: PlayerIndex,
  next: NextContext
): GameEvent[] {
  const activePhases = [
    'dealing',
    'bidding',
    'dabb',
    'trump',
    'discard',
    'melding',
    'tricks',
    'scoring',
  ];
  if (!activePhases.includes(state.phase)) {
    throw new GameError(GAME_ERROR_CODES.CANNOT_TERMINATE_IN_CURRENT_PHASE);
  }
  return [createGameTerminatedEvent(next(), playerIndex)];
}

/**
 * The events a player's action produces, whoever the player is.
 *
 * The three engines used to each carry their own copy of this mapping — an if/else chain
 * in the online AI driver, a per-phase switch offline, another in the simulation — and only
 * the online one validated anything.
 */
export function createEventsForAction(
  state: GameState,
  playerIndex: PlayerIndex,
  action: AIAction,
  next: NextContext
): GameEvent[] {
  switch (action.type) {
    case 'bid':
      return createBidPlacedEvents(state, playerIndex, action.amount, next);
    case 'pass':
      return createPlayerPassedEvents(state, playerIndex, next);
    case 'takeDabb':
      return createTakeDabbEvents(state, playerIndex, next);
    case 'declareTrump':
      return createDeclareTrumpEvents(state, playerIndex, action.suit, next);
    case 'discard':
      return createDiscardCardsEvents(state, playerIndex, action.cardIds, next);
    case 'goOut':
      return createGoOutEvents(state, playerIndex, next);
    case 'declareMelds':
      return createDeclareMeldsEvents(state, playerIndex, next);
    case 'playCard':
      return createPlayCardEvents(state, playerIndex, action.cardId, next);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      throw new GameError(GAME_ERROR_CODES.UNKNOWN_ERROR);
    }
  }
}
