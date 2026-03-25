import type { Point } from './arcPath.js';

export interface SweepEntry {
  cardId: string;
  destination: Point;
  delay: number; // ms before this card's animation starts
}

/**
 * Computes a trailing sweep schedule for trick cards moving to the winner's pile.
 * @param cardIds     All card IDs in the completed trick
 * @param destination Winner's won-pile corner position
 * @param arrivalGap  ms between each card's arrival (default 200)
 */
export function computeSweepSchedule(
  cardIds: string[],
  destination: Point,
  arrivalGap: number = 200
): SweepEntry[] {
  return cardIds.map((cardId, i) => ({ cardId, destination, delay: i * arrivalGap }));
}
