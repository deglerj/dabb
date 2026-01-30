/**
 * Event generators for creating game events
 */

import { v4 as uuidv4 } from 'uuid';

import {
  BidPlacedEvent,
  BiddingWonEvent,
  Card,
  CardPlayedEvent,
  CardsDealtEvent,
  CardsDiscardedEvent,
  DabbTakenEvent,
  GameEvent,
  GameFinishedEvent,
  GameStartedEvent,
  GameTerminatedEvent,
  Meld,
  MeldingCompleteEvent,
  MeldsDeclaredEvent,
  NewRoundStartedEvent,
  PlayerIndex,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerPassedEvent,
  PlayerReconnectedEvent,
  RoundScoredEvent,
  Suit,
  Team,
  TrickWonEvent,
  TrumpDeclaredEvent,
} from '@dabb/shared-types';

interface EventContext {
  sessionId: string;
  sequence: number;
}

function createBaseEvent(ctx: EventContext): Omit<GameEvent, 'type' | 'payload'> {
  return {
    id: uuidv4(),
    sessionId: ctx.sessionId,
    sequence: ctx.sequence,
    timestamp: Date.now(),
  };
}

export function createGameStartedEvent(
  ctx: EventContext,
  playerCount: number,
  targetScore: number,
  dealer: PlayerIndex
): GameStartedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'GAME_STARTED',
    payload: { playerCount, targetScore, dealer },
  };
}

export function createPlayerJoinedEvent(
  ctx: EventContext,
  playerId: string,
  playerIndex: PlayerIndex,
  nickname: string,
  team?: Team
): PlayerJoinedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'PLAYER_JOINED',
    payload: { playerId, playerIndex, nickname, team },
  };
}

export function createPlayerLeftEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex
): PlayerLeftEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'PLAYER_LEFT',
    payload: { playerIndex },
  };
}

export function createPlayerReconnectedEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex
): PlayerReconnectedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'PLAYER_RECONNECTED',
    payload: { playerIndex },
  };
}

export function createCardsDealtEvent(
  ctx: EventContext,
  hands: Record<PlayerIndex, Card[]>,
  dabb: Card[]
): CardsDealtEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'CARDS_DEALT',
    payload: { hands, dabb },
  };
}

export function createBidPlacedEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  amount: number
): BidPlacedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'BID_PLACED',
    payload: { playerIndex, amount },
  };
}

export function createPlayerPassedEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex
): PlayerPassedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'PLAYER_PASSED',
    payload: { playerIndex },
  };
}

export function createBiddingWonEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  winningBid: number
): BiddingWonEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'BIDDING_WON',
    payload: { playerIndex, winningBid },
  };
}

export function createDabbTakenEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  dabbCards: Card[]
): DabbTakenEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'DABB_TAKEN',
    payload: { playerIndex, dabbCards },
  };
}

export function createCardsDiscardedEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  discardedCards: string[]
): CardsDiscardedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'CARDS_DISCARDED',
    payload: { playerIndex, discardedCards },
  };
}

export function createTrumpDeclaredEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  suit: Suit
): TrumpDeclaredEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'TRUMP_DECLARED',
    payload: { playerIndex, suit },
  };
}

export function createMeldsDeclaredEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  melds: Meld[],
  totalPoints: number
): MeldsDeclaredEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'MELDS_DECLARED',
    payload: { playerIndex, melds, totalPoints },
  };
}

export function createMeldingCompleteEvent(
  ctx: EventContext,
  meldScores: Record<PlayerIndex, number>
): MeldingCompleteEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'MELDING_COMPLETE',
    payload: { meldScores },
  };
}

export function createCardPlayedEvent(
  ctx: EventContext,
  playerIndex: PlayerIndex,
  card: Card
): CardPlayedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'CARD_PLAYED',
    payload: { playerIndex, card },
  };
}

export function createTrickWonEvent(
  ctx: EventContext,
  winnerIndex: PlayerIndex,
  cards: Card[],
  points: number
): TrickWonEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'TRICK_WON',
    payload: { winnerIndex, cards, points },
  };
}

export function createRoundScoredEvent(
  ctx: EventContext,
  scores: Record<
    PlayerIndex | Team,
    {
      melds: number;
      tricks: number;
      total: number;
      bidMet: boolean;
    }
  >,
  totalScores: Record<PlayerIndex | Team, number>
): RoundScoredEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'ROUND_SCORED',
    payload: { scores, totalScores },
  };
}

export function createGameFinishedEvent(
  ctx: EventContext,
  winner: PlayerIndex | Team,
  finalScores: Record<PlayerIndex | Team, number>
): GameFinishedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'GAME_FINISHED',
    payload: { winner, finalScores },
  };
}

export function createNewRoundStartedEvent(
  ctx: EventContext,
  round: number,
  dealer: PlayerIndex
): NewRoundStartedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'NEW_ROUND_STARTED',
    payload: { round, dealer },
  };
}

export function createGameTerminatedEvent(
  ctx: EventContext,
  terminatedBy: PlayerIndex,
  reason: 'player_exit' = 'player_exit'
): GameTerminatedEvent {
  return {
    ...createBaseEvent(ctx),
    type: 'GAME_TERMINATED',
    payload: { terminatedBy, reason },
  };
}
