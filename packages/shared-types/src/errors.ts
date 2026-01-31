/**
 * Server error codes for internationalization.
 * Server sends error codes, clients translate them.
 */
export const SERVER_ERROR_CODES = {
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_CODE_GENERATION_FAILED: 'SESSION_CODE_GENERATION_FAILED',

  // Game start errors
  NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',

  // General game errors
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  GAME_STATE_NOT_INITIALIZED: 'GAME_STATE_NOT_INITIALIZED',

  // Bidding phase errors
  NOT_IN_BIDDING_PHASE: 'NOT_IN_BIDDING_PHASE',
  NOT_YOUR_TURN_TO_BID: 'NOT_YOUR_TURN_TO_BID',
  INVALID_BID_AMOUNT: 'INVALID_BID_AMOUNT',
  FIRST_BIDDER_MUST_BID: 'FIRST_BIDDER_MUST_BID',

  // Dabb phase errors
  NOT_IN_DABB_PHASE: 'NOT_IN_DABB_PHASE',
  ONLY_BID_WINNER_CAN_TAKE_DABB: 'ONLY_BID_WINNER_CAN_TAKE_DABB',
  ONLY_BID_WINNER_CAN_DISCARD: 'ONLY_BID_WINNER_CAN_DISCARD',
  MUST_DISCARD_EXACT_COUNT: 'MUST_DISCARD_EXACT_COUNT',
  CARD_NOT_IN_HAND: 'CARD_NOT_IN_HAND',

  // Going out errors
  ONLY_BID_WINNER_CAN_GO_OUT: 'ONLY_BID_WINNER_CAN_GO_OUT',
  MUST_TAKE_DABB_BEFORE_GOING_OUT: 'MUST_TAKE_DABB_BEFORE_GOING_OUT',

  // Trump phase errors
  NOT_IN_TRUMP_PHASE: 'NOT_IN_TRUMP_PHASE',
  ONLY_BID_WINNER_CAN_DECLARE_TRUMP: 'ONLY_BID_WINNER_CAN_DECLARE_TRUMP',

  // Melding phase errors
  NOT_IN_MELDING_PHASE: 'NOT_IN_MELDING_PHASE',
  CANNOT_MELD_WHEN_GOING_OUT: 'CANNOT_MELD_WHEN_GOING_OUT',
  ALREADY_DECLARED_MELDS: 'ALREADY_DECLARED_MELDS',

  // Tricks phase errors
  NOT_IN_TRICKS_PHASE: 'NOT_IN_TRICKS_PHASE',
  INVALID_PLAY: 'INVALID_PLAY',

  // Game termination errors
  CANNOT_TERMINATE_IN_CURRENT_PHASE: 'CANNOT_TERMINATE_IN_CURRENT_PHASE',

  // Generic fallback
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[keyof typeof SERVER_ERROR_CODES];

/**
 * Error class for game-related errors that includes an error code
 * for client-side translation.
 */
export class GameError extends Error {
  public readonly code: ServerErrorCode;
  public readonly params?: Record<string, string | number>;

  constructor(code: ServerErrorCode, params?: Record<string, string | number>) {
    super(code);
    this.name = 'GameError';
    this.code = code;
    this.params = params;
  }
}
