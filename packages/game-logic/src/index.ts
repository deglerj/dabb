// Cards
export { createDeck, dealCards, shuffleDeck, sortHand } from './cards/index.js';

// Events
export {
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDealtEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createGameFinishedEvent,
  createGameStartedEvent,
  createGameTerminatedEvent,
  createGoingOutEvent,
  createMeldingCompleteEvent,
  createMeldsDeclaredEvent,
  createNewRoundStartedEvent,
  createPlayerJoinedEvent,
  createPlayerPassedEvent,
  createRoundScoredEvent,
  createTrickWonEvent,
  createTrumpDeclaredEvent,
} from './events/index.js';

// Melds
export { calculateMeldPoints, detectMelds } from './melds/index.js';

// Phases
export {
  calculatePlayerTrickRawPoints,
  calculateTrickPoints,
  canPass,
  CARD_STRENGTH,
  cardBeats,
  determineTrickWinner,
  getBiddingWinner,
  getCurrentTrickWinner,
  getFirstBidder,
  getMinBid,
  getNextBidder,
  getPartnerIndex,
  getValidPlays,
  isBiddingComplete,
  isPartnerWinning,
  isValidBid,
  isValidPlay,
  LAST_TRICK_BONUS,
} from './phases/index.js';

// State
export {
  applyEvent,
  applyEvents,
  createInitialState,
  filterEventForPlayer,
  filterEventsForPlayer,
  resetForNewRound,
  whoActsNext,
  isWaitingOn,
  determineGameWinner,
} from './state/index.js';

// Export
export { formatCard, formatSuit, formatEventLog } from './export/index.js';
export type { EventLogPlayer, EventLogOptions } from './export/index.js';

// Engine — player actions in, game events out
export {
  createBidPlacedEvents,
  createDealEvent,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createEventsForAction,
  createGoOutEvents,
  createGoingOutScoreEvents,
  createPlayCardEvents,
  createPlayerPassedEvents,
  createRoundEndEvents,
  createStartGameEvents,
  createTakeDabbEvents,
  createTerminateGameEvents,
} from './engine/index.js';
export type { EventContext, NextContext, PlayerInfo } from './engine/index.js';
