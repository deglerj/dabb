/**
 * How the engine stamps the events it produces.
 */

import type { PlayerIndex } from '@dabb/shared-types';

export interface EventContext {
  sessionId: string;
  sequence: number;
  /** Non-secret seat that caused this event. */
  actor?: PlayerIndex;
  /** Authenticated AI execution grant used for this cascade. */
  claimId?: string;
}

/**
 * Yields the context for the next event, advancing the sequence each call.
 *
 * A cascade emits several events at once (a card play can finish a trick, a round and the
 * whole game), so the caller owns the counter and the engine just asks for the next slot.
 */
export type NextContext = () => EventContext;
