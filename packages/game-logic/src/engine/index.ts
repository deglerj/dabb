/**
 * The rules engine: player actions in, game events out.
 */

export type { EventContext, NextContext } from './context.js';
export { createDealEvent } from './deal.js';
export { createGoingOutScoreEvents, createRoundEndEvents } from './scoring.js';
export {
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createEventsForAction,
  createGoOutEvents,
  createPlayCardEvents,
  createPlayerPassedEvents,
  createStartGameEvents,
  createTakeDabbEvents,
  createTerminateGameEvents,
} from './actions.js';
export type { PlayerInfo } from './actions.js';
