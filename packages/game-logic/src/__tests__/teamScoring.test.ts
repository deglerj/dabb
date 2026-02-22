/**
 * Integration tests for 4-player team-based scoring
 *
 * In 4-player Binokel, players are assigned to two teams.
 * Scores are aggregated per team, not per individual player.
 */

import { describe, it, expect } from 'vitest';
import type { GameEvent, PlayerIndex, Team } from '@dabb/shared-types';
import { applyEvents } from '../state/reducer.js';
import {
  createPlayerJoinedEvent,
  createGameStartedEvent,
  createRoundScoredEvent,
  createGameFinishedEvent,
} from '../events/generators.js';

type TeamScores = Record<Team, { melds: number; tricks: number; total: number; bidMet: boolean }>;
type TeamTotals = Record<Team, number>;

// Cast team-keyed objects to the wider type expected by generators
function asScores(
  s: TeamScores
): Record<PlayerIndex | Team, { melds: number; tricks: number; total: number; bidMet: boolean }> {
  return s as unknown as Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;
}
function asTotals(t: TeamTotals): Record<PlayerIndex | Team, number> {
  return t as unknown as Record<PlayerIndex | Team, number>;
}

// Helper to build a minimal 4-player game state up through the start
function setup4PlayerGame() {
  let seq = 0;
  const sessionId = 'team-test';
  const ctx = () => ({ sessionId, sequence: ++seq });
  const events: GameEvent[] = [];

  // Players join: 0 & 2 on team 0, 1 & 3 on team 1
  events.push(createPlayerJoinedEvent(ctx(), 'p0', 0 as PlayerIndex, 'Alice', 0 as Team));
  events.push(createPlayerJoinedEvent(ctx(), 'p1', 1 as PlayerIndex, 'Bob', 1 as Team));
  events.push(createPlayerJoinedEvent(ctx(), 'p2', 2 as PlayerIndex, 'Carol', 0 as Team));
  events.push(createPlayerJoinedEvent(ctx(), 'p3', 3 as PlayerIndex, 'Dave', 1 as Team));

  events.push(createGameStartedEvent(ctx(), 4, 1000, 0 as PlayerIndex));

  return { events, ctx, sessionId };
}

describe('4-player team scoring', () => {
  it('assigns players to teams from PLAYER_JOINED events', () => {
    const { events } = setup4PlayerGame();
    const state = applyEvents(events);

    expect(state.players).toHaveLength(4);
    expect(state.players.find((p) => p.playerIndex === 0)?.team).toBe(0);
    expect(state.players.find((p) => p.playerIndex === 1)?.team).toBe(1);
    expect(state.players.find((p) => p.playerIndex === 2)?.team).toBe(0);
    expect(state.players.find((p) => p.playerIndex === 3)?.team).toBe(1);
  });

  it('stores only 2 keys (team 0 and team 1) in totalScores after ROUND_SCORED', () => {
    const { events, ctx } = setup4PlayerGame();

    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 100, tricks: 60, total: 160, bidMet: true },
          1: { melds: 40, tricks: 40, total: 80, bidMet: true },
        }),
        asTotals({ 0: 160, 1: 80 })
      )
    );

    const state = applyEvents(events);

    // Should have exactly 2 entries (team 0 and team 1)
    expect(state.totalScores.size).toBe(2);
    expect(state.totalScores.get(0 as Team)).toBe(160);
    expect(state.totalScores.get(1 as Team)).toBe(80);
  });

  it('team bid met: both team members get combined score', () => {
    const { events, ctx } = setup4PlayerGame();

    // Team 0 (Alice + Carol) bids 150 and meets it
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 80, tricks: 90, total: 170, bidMet: true },
          1: { melds: 40, tricks: 30, total: 70, bidMet: true },
        }),
        asTotals({ 0: 170, 1: 70 })
      )
    );

    const state = applyEvents(events);

    expect(state.totalScores.get(0 as Team)).toBe(170);
    expect(state.totalScores.get(1 as Team)).toBe(70);
  });

  it('team bid not met: bid winner team gets -2× bid, only 2 scoring keys', () => {
    const { events, ctx } = setup4PlayerGame();

    // Team 0 bid 150 but combined total < 150 → bidMet=false → total=-300
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 60, tricks: 40, total: -300, bidMet: false },
          1: { melds: 60, tricks: 40, total: 100, bidMet: true },
        }),
        asTotals({ 0: -300, 1: 100 })
      )
    );

    const state = applyEvents(events);

    // Scores are per-team (only 2 keys, not 4 player keys)
    expect(state.totalScores.size).toBe(2);
    expect(state.totalScores.get(0 as Team)).toBe(-300);
    expect(state.totalScores.get(1 as Team)).toBe(100);
    // No individual player keys at index 2 or 3
    expect(state.totalScores.get(2 as PlayerIndex)).toBeUndefined();
    expect(state.totalScores.get(3 as PlayerIndex)).toBeUndefined();
  });

  it('going out (4-player): bid winner team loses bid, opponent team gets melds + 40', () => {
    const { events, ctx } = setup4PlayerGame();

    // Team 0 bid winner went out with bid=150
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 0, tricks: 0, total: -150, bidMet: false },
          1: { melds: 60, tricks: 0, total: 100, bidMet: true },
        }),
        asTotals({ 0: -150, 1: 100 })
      )
    );

    const state = applyEvents(events);

    expect(state.totalScores.size).toBe(2);
    expect(state.totalScores.get(0 as Team)).toBe(-150);
    expect(state.totalScores.get(1 as Team)).toBe(100);
  });

  it('game win: team reaching target score wins, GAME_FINISHED uses team key', () => {
    const { events, ctx } = setup4PlayerGame();

    // Round 1: team 0 gets 800
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 400, tricks: 400, total: 800, bidMet: true },
          1: { melds: 100, tricks: 100, total: 200, bidMet: true },
        }),
        asTotals({ 0: 800, 1: 200 })
      )
    );
    // Round 2: team 0 gets 300, reaching 1100 ≥ 1000
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 150, tricks: 150, total: 300, bidMet: true },
          1: { melds: 100, tricks: 100, total: 200, bidMet: true },
        }),
        asTotals({ 0: 1100, 1: 400 })
      )
    );
    events.push(createGameFinishedEvent(ctx(), 0 as Team, asTotals({ 0: 1100, 1: 400 })));

    const state = applyEvents(events);

    expect(state.phase).toBe('finished');
    expect(state.totalScores.get(0 as Team)).toBe(1100);
    expect(state.totalScores.get(1 as Team)).toBe(400);
  });

  it('cumulative scores: totalScores accumulate across rounds per team', () => {
    const { events, ctx } = setup4PlayerGame();

    // Round 1
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 100, tricks: 80, total: 180, bidMet: true },
          1: { melds: 60, tricks: 40, total: 100, bidMet: true },
        }),
        asTotals({ 0: 180, 1: 100 })
      )
    );

    let state = applyEvents(events);
    expect(state.totalScores.get(0 as Team)).toBe(180);
    expect(state.totalScores.get(1 as Team)).toBe(100);

    // Round 2
    events.push(
      createRoundScoredEvent(
        ctx(),
        asScores({
          0: { melds: 80, tricks: 60, total: 140, bidMet: true },
          1: { melds: 100, tricks: 100, total: 200, bidMet: true },
        }),
        asTotals({ 0: 320, 1: 300 })
      )
    );

    state = applyEvents(events);
    expect(state.totalScores.get(0 as Team)).toBe(320);
    expect(state.totalScores.get(1 as Team)).toBe(300);
  });
});
