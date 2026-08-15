/**
 * AI player types
 */

import type { CardId, Suit } from './cards.js';
import type { GameState, PlayerIndex } from './game.js';

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

/** No suit: going out happens after trump is declared, so the engine reads it from state. */
export interface AIGoOutAction {
  type: 'goOut';
}

export interface AIDeclareTrumpAction {
  type: 'declareTrump';
  suit: Suit;
}

/**
 * Melds carry no payload: the acting engine derives them from the player's own hand with
 * `detectMelds()`. Nothing ever declares a subset, so letting the caller supply a meld list
 * only creates a way for hand and declaration to disagree.
 */
export interface AIDeclareMeldsAction {
  type: 'declareMelds';
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
 * German boomer-generation first names for AI players (used in both online and offline modes).
 */
export const AI_NAMES = [
  'Hans',
  'Greta',
  'Helga',
  'Werner',
  'Ingrid',
  'Horst',
  'Gerda',
  'Klaus',
  'Irmgard',
  'Günther',
  'Hildegard',
  'Dieter',
  'Ursula',
  'Manfred',
  'Erika',
  'Siegfried',
  'Renate',
  'Wolfgang',
  'Brigitte',
  'Helmut',
  'Christa',
  'Rolf',
  'Elfriede',
  'Heinz',
  'Lieselotte',
] as const;

/** Nicknames compare trimmed and case-insensitively, so "hans " and "Hans" are the same name. */
export function sameNickname(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * AI names nobody at the table uses yet, in list order. Every mode that hands a bot a name goes
 * through this so a bot never shares a human's nickname (a table holds at most four players, so
 * the list can never run dry).
 */
export function availableAINames(taken: Iterable<string>): string[] {
  const used = [...taken];
  return AI_NAMES.filter((name) => !used.some((t) => sameNickname(t, name)));
}

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
