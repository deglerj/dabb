import { describe, expect, it } from 'vitest';
import type { PlayerIndex, Team } from '@dabb/shared-types';
import { determineGameWinner } from '../state/winner.js';

const PLAYERS_3: (PlayerIndex | Team)[] = [0, 1, 2] as PlayerIndex[];
const TEAMS: (PlayerIndex | Team)[] = [0, 1] as Team[];

describe('determineGameWinner', () => {
  it('returns null while nobody has reached the target', () => {
    expect(determineGameWinner({ 0: 990, 1: 800, 2: 10 }, PLAYERS_3, 1000, 0)).toBeNull();
  });

  it('returns the only player at or above the target', () => {
    expect(determineGameWinner({ 0: 400, 1: 1010, 2: 300 }, PLAYERS_3, 1000, 0)).toBe(1);
  });

  it('counts an exact target score as reaching it', () => {
    expect(determineGameWinner({ 0: 1000, 1: 900, 2: 200 }, PLAYERS_3, 1000, 1)).toBe(0);
  });

  it('gives it to the highest when several cross in the same round', () => {
    // The bid winner has no priority unless the scores are level.
    expect(determineGameWinner({ 0: 1010, 1: 1150, 2: 300 }, PLAYERS_3, 1000, 0)).toBe(1);
  });

  it('gives a tie to the bid winner rather than the lowest seat (regression)', () => {
    // Every scoring component is a multiple of ten, so exact ties are common enough to need
    // a rule. It used to fall to seat order because the comparison was a strict `>`.
    expect(determineGameWinner({ 0: 1100, 1: 1100, 2: 500 }, PLAYERS_3, 1000, 1)).toBe(1);
    expect(determineGameWinner({ 0: 1100, 1: 1100, 2: 500 }, PLAYERS_3, 1000, 0)).toBe(0);
  });

  it('ignores the bid winner when they are not among the tied leaders', () => {
    // Player 2 bid and missed; 0 and 1 are level, and seat order is all that is left.
    expect(determineGameWinner({ 0: 1100, 1: 1100, 2: 200 }, PLAYERS_3, 1000, 2)).toBe(0);
  });

  it('ignores a bid winner who reached the target but scored lower', () => {
    expect(determineGameWinner({ 0: 1010, 1: 1200, 2: 0 }, PLAYERS_3, 1000, 0)).toBe(1);
  });

  it('works team-keyed for 4-player games', () => {
    expect(determineGameWinner({ 0: 1050, 1: 1050 }, TEAMS, 1000, 1)).toBe(1);
    expect(determineGameWinner({ 0: 1050, 1: 990 }, TEAMS, 1000, 1)).toBe(0);
  });

  it('tolerates a missing score entry', () => {
    expect(determineGameWinner({ 0: 1000 }, PLAYERS_3, 1000, 0)).toBe(0);
  });

  it('still resolves when there is no bid winner to fall back on', () => {
    expect(determineGameWinner({ 0: 1100, 1: 1100, 2: 0 }, PLAYERS_3, 1000, null)).toBe(0);
  });
});
