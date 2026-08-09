/**
 * How the engine stamps the events it produces.
 */

export interface EventContext {
  sessionId: string;
  sequence: number;
}

/**
 * Yields the context for the next event, advancing the sequence each call.
 *
 * A cascade emits several events at once (a card play can finish a trick, a round and the
 * whole game), so the caller owns the counter and the engine just asks for the next slot.
 */
export type NextContext = () => EventContext;
