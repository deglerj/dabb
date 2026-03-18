/**
 * Regression test: handleRoundScored was silently dropping roundScores,
 * leaving state.roundScores as an empty Map after a ROUND_SCORED event.
 */
import { describe, it, expect } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';
import { applyEvents } from '../state/reducer.js';
import { createRoundScoredEvent } from '../events/generators.js';

describe('ROUND_SCORED reducer (regression)', () => {
  it('populates roundScores from event payload (regression)', () => {
    const ctx = { sessionId: 'test', sequence: 1 };
    const scores = {
      [0 as PlayerIndex]: { melds: 80, tricks: 120, total: 200, bidMet: true },
      [1 as PlayerIndex]: { melds: 40, tricks: 60, total: 100, bidMet: false },
    } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>;
    const totalScores = {
      [0 as PlayerIndex]: 200,
      [1 as PlayerIndex]: 100,
    } as Record<PlayerIndex, number>;

    const event = createRoundScoredEvent(ctx, scores, totalScores);
    const state = applyEvents([event]);

    expect(state.roundScores.size).toBe(2);
    expect(state.roundScores.get(0 as PlayerIndex)).toEqual({ melds: 80, tricks: 120, total: 200 });
    expect(state.roundScores.get(1 as PlayerIndex)).toEqual({ melds: 40, tricks: 60, total: 100 });
    // bidMet is stripped — RoundScore type does not include it
    expect(state.roundScores.get(0 as PlayerIndex)).not.toHaveProperty('bidMet');
  });

  it('resets roundScores between rounds (regression)', () => {
    const ctx1 = { sessionId: 'test', sequence: 1 };
    const ctx2 = { sessionId: 'test', sequence: 2 };
    const scores = {
      [0 as PlayerIndex]: { melds: 80, tricks: 120, total: 200, bidMet: true },
      [1 as PlayerIndex]: { melds: 40, tricks: 60, total: 100, bidMet: false },
    } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>;
    const totalScores = { [0 as PlayerIndex]: 200, [1 as PlayerIndex]: 100 } as Record<
      PlayerIndex,
      number
    >;

    const round1Event = createRoundScoredEvent(ctx1, scores, totalScores);
    const round2Event = createRoundScoredEvent(
      ctx2,
      {
        [0 as PlayerIndex]: { melds: 0, tricks: 0, total: 0, bidMet: false },
        [1 as PlayerIndex]: { melds: 0, tricks: 0, total: 0, bidMet: false },
      } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>,
      totalScores
    );

    const state = applyEvents([round1Event, round2Event]);

    // Second ROUND_SCORED overwrites, not accumulates
    expect(state.roundScores.get(0 as PlayerIndex)).toEqual({ melds: 0, tricks: 0, total: 0 });
  });
});
