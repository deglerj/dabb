/**
 * Deciding whether a round ended the game, and who won it.
 */

import type { PlayerIndex, Team } from '@dabb/shared-types';

/**
 * The winner after a round, or null if the game continues.
 *
 * Several players (or both teams) can cross the target in the same round, because everyone
 * scores their own melds and tricks. The highest total wins. On an exact tie the bid winner
 * takes it — they contracted for a number and delivered it, so they cross the line first.
 *
 * Exact ties are not a curiosity: every scoring component is a multiple of ten (meld values,
 * trick totals after rounding, the going-out bonus, `-2 × bid`), so totals sit on a ten-point
 * grid and land on each other often enough to need a rule.
 *
 * If the tied players do not include the bid winner there is nothing left to separate them
 * and the first of `candidates` wins — seat order, and arbitrary. Rare enough to live with;
 * dealing another round instead would be the alternative.
 *
 * @param totalScores  Cumulative scores keyed by player index (2/3-player) or team (4-player)
 * @param candidates   The keys to consider, in seat order — [0..playerCount-1] or [0, 1]
 * @param targetScore  Score needed to win, normally 1000
 * @param bidWinnerKey The bid winner of the round just scored, as a player index or their team
 */
export function determineGameWinner(
  totalScores: Partial<Record<PlayerIndex | Team, number>>,
  candidates: (PlayerIndex | Team)[],
  targetScore: number,
  bidWinnerKey: PlayerIndex | Team | null
): PlayerIndex | Team | null {
  // A 3-player game never fills seat 3, and a team game fills only 0 and 1.
  const scoreOf = (key: PlayerIndex | Team) => totalScores[key] ?? 0;

  const atTarget = candidates.filter((key) => scoreOf(key) >= targetScore);
  if (atTarget.length === 0) {
    return null;
  }

  const highest = Math.max(...atTarget.map(scoreOf));
  const tied = atTarget.filter((key) => scoreOf(key) === highest);

  if (tied.length === 1) {
    return tied[0];
  }
  if (bidWinnerKey !== null && tied.includes(bidWinnerKey)) {
    return bidWinnerKey;
  }
  return tied[0];
}
