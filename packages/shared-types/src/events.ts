/**
 * Event sourcing event types
 */

import type { Card, CardId, Suit } from './cards.js';
import type { Meld, PlayerIndex, Team } from './game.js';

// Base event interface
export interface BaseEvent {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: number;
}

// Game lifecycle events
export interface GameStartedEvent extends BaseEvent {
  type: 'GAME_STARTED';
  payload: {
    playerCount: number;
    targetScore: number;
    dealer: PlayerIndex;
  };
}

export interface CardsDealtEvent extends BaseEvent {
  type: 'CARDS_DEALT';
  payload: {
    hands: Record<PlayerIndex, Card[]>;
    dabb: Card[];
  };
}

// Bidding events
export interface BidPlacedEvent extends BaseEvent {
  type: 'BID_PLACED';
  payload: {
    playerIndex: PlayerIndex;
    amount: number;
  };
}

export interface PlayerPassedEvent extends BaseEvent {
  type: 'PLAYER_PASSED';
  payload: {
    playerIndex: PlayerIndex;
  };
}

export interface BiddingWonEvent extends BaseEvent {
  type: 'BIDDING_WON';
  payload: {
    playerIndex: PlayerIndex;
    winningBid: number;
  };
}

// Dabb events
export interface DabbTakenEvent extends BaseEvent {
  type: 'DABB_TAKEN';
  payload: {
    playerIndex: PlayerIndex;
    dabbCards: Card[];
  };
}

export interface CardsDiscardedEvent extends BaseEvent {
  type: 'CARDS_DISCARDED';
  payload: {
    playerIndex: PlayerIndex;
    discardedCards: CardId[];
  };
}

// Trump events
export interface TrumpDeclaredEvent extends BaseEvent {
  type: 'TRUMP_DECLARED';
  payload: {
    playerIndex: PlayerIndex;
    suit: Suit;
  };
}

// Melding events
export interface MeldsDeclaredEvent extends BaseEvent {
  type: 'MELDS_DECLARED';
  payload: {
    playerIndex: PlayerIndex;
    melds: Meld[];
    totalPoints: number;
  };
}

export interface MeldingCompleteEvent extends BaseEvent {
  type: 'MELDING_COMPLETE';
  payload: {
    meldScores: Record<PlayerIndex, number>;
  };
}

// Trick events
export interface CardPlayedEvent extends BaseEvent {
  type: 'CARD_PLAYED';
  payload: {
    playerIndex: PlayerIndex;
    card: Card;
  };
}

export interface TrickWonEvent extends BaseEvent {
  type: 'TRICK_WON';
  payload: {
    winnerIndex: PlayerIndex;
    cards: Card[];
    points: number;
  };
}

// Scoring events
export interface RoundScoredEvent extends BaseEvent {
  type: 'ROUND_SCORED';
  payload: {
    scores: Record<
      PlayerIndex | Team,
      {
        melds: number;
        tricks: number;
        total: number;
        bidMet: boolean;
      }
    >;
    totalScores: Record<PlayerIndex | Team, number>;
  };
}

export interface GameFinishedEvent extends BaseEvent {
  type: 'GAME_FINISHED';
  payload: {
    winner: PlayerIndex | Team;
    finalScores: Record<PlayerIndex | Team, number>;
  };
}

// Player events
export interface PlayerJoinedEvent extends BaseEvent {
  type: 'PLAYER_JOINED';
  payload: {
    playerId: string;
    playerIndex: PlayerIndex;
    nickname: string;
    team?: Team;
  };
}

export interface PlayerLeftEvent extends BaseEvent {
  type: 'PLAYER_LEFT';
  payload: {
    playerIndex: PlayerIndex;
  };
}

export interface PlayerReconnectedEvent extends BaseEvent {
  type: 'PLAYER_RECONNECTED';
  payload: {
    playerIndex: PlayerIndex;
  };
}

// New round event
export interface NewRoundStartedEvent extends BaseEvent {
  type: 'NEW_ROUND_STARTED';
  payload: {
    round: number;
    dealer: PlayerIndex;
  };
}

// Union type of all events
export type GameEvent =
  | GameStartedEvent
  | CardsDealtEvent
  | BidPlacedEvent
  | PlayerPassedEvent
  | BiddingWonEvent
  | DabbTakenEvent
  | CardsDiscardedEvent
  | TrumpDeclaredEvent
  | MeldsDeclaredEvent
  | MeldingCompleteEvent
  | CardPlayedEvent
  | TrickWonEvent
  | RoundScoredEvent
  | GameFinishedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerReconnectedEvent
  | NewRoundStartedEvent;

export type GameEventType = GameEvent['type'];
