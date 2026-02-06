/**
 * AI player types
 */

import type { CardId, Suit } from './cards.js';
import type { GameState, Meld, PlayerIndex } from './game.js';

/**
 * AI action types - each corresponds to a game action
 */
export interface AIBidAction {
  type: 'bid';
  amount: number;
}

export interface AIPassAction {
  type: 'pass';
}

export interface AITakeDabbAction {
  type: 'takeDabb';
}

export interface AIDiscardAction {
  type: 'discard';
  cardIds: CardId[];
}

export interface AIGoOutAction {
  type: 'goOut';
  suit: Suit;
}

export interface AIDeclareTrumpAction {
  type: 'declareTrump';
  suit: Suit;
}

export interface AIDeclareMeldsAction {
  type: 'declareMelds';
  melds: Meld[];
}

export interface AIPlayCardAction {
  type: 'playCard';
  cardId: CardId;
}

/**
 * Union of all possible AI actions
 */
export type AIAction =
  | AIBidAction
  | AIPassAction
  | AITakeDabbAction
  | AIDiscardAction
  | AIGoOutAction
  | AIDeclareTrumpAction
  | AIDeclareMeldsAction
  | AIPlayCardAction;

/**
 * Context provided to AI for making decisions
 */
export interface AIDecisionContext {
  /** Current game state (with full visibility for this player) */
  gameState: GameState;

  /** The AI player's index */
  playerIndex: PlayerIndex;

  /** Session ID for logging purposes */
  sessionId: string;
}
