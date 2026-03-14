import type { Point } from './arcPath.js';

export interface DealEntry {
  cardId: string;
  delay: number; // ms before this card's animation starts
  from: Point; // source position (central deck) — passed in by the app
}

/**
 * Computes a staggered deal schedule.
 * @param cardIds   Ordered card IDs to deal
 * @param interval  ms between each card departure (default 80)
 * @param from      Screen position of the central deck (passed through, not calculated here)
 */
export function computeDealSchedule(
  cardIds: string[],
  interval: number = 80,
  from: Point = { x: 0, y: 0 }
): DealEntry[] {
  return cardIds.map((cardId, i) => ({ cardId, delay: i * interval, from }));
}
