/**
 * Tests for the per-seat strategy harness.
 *
 * Without this, every seat gets an identical bot and one strategy generation cannot be played
 * against another — which makes every threshold in docs/design/AI_STRATEGY_V2.md unmeasurable.
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { SimulationEngine } from '../simulation/SimulationEngine.js';

describe('per-seat strategy config', () => {
  it('reports the strategy that sat in each seat', async () => {
    const engine = new SimulationEngine({
      sessionId: 'seat-strategies',
      playerCount: 2,
      targetScore: 200,
      maxActions: 5000,
      timeoutMs: 30000,
      difficulty: 'hard',
      seats: [{ strategy: 2 }, { strategy: 1 }],
    });

    const result = await engine.run();

    expect(result.error).toBeUndefined();
    expect(result.seatStrategies).toEqual([2, 1]);
  });

  it('defaults every seat to strategy 1 when no seats are given', async () => {
    const engine = new SimulationEngine({
      sessionId: 'seat-strategies-default',
      playerCount: 2,
      targetScore: 200,
      maxActions: 5000,
      timeoutMs: 30000,
      difficulty: 'hard',
    });

    const result = await engine.run();

    expect(result.error).toBeUndefined();
    expect(result.seatStrategies).toEqual([1, 1]);
  });

  it('plays a full game to completion regardless of the mix (harness null test)', async () => {
    // Strategy 2 is still identical to 1 at this point, so this only proves the plumbing does
    // not break the game. It becomes the real v1-vs-v2 comparison once P2 lands.
    const results = await Promise.all(
      [0, 1, 2, 3].map((gameIndex) =>
        new SimulationEngine({
          sessionId: `null-test-${gameIndex}`,
          playerCount: 2,
          targetScore: 300,
          maxActions: 5000,
          timeoutMs: 30000,
          difficulty: 'hard',
          // Rotated the way the runner rotates it, so both seats see both strategies.
          seats:
            gameIndex % 2 === 0
              ? [{ strategy: 2 }, { strategy: 1 }]
              : [{ strategy: 1 }, { strategy: 2 }],
        }).run()
      )
    );

    for (const result of results) {
      expect(result.error).toBeUndefined();
      expect(result.winner).not.toBeNull();
      expect(result.seatStrategies).toHaveLength(2);
    }
  });

  it('gives each seat its own difficulty', async () => {
    const engine = new SimulationEngine({
      sessionId: 'seat-difficulty',
      playerCount: 2,
      targetScore: 200,
      maxActions: 5000,
      timeoutMs: 30000,
      seats: [{ difficulty: 'hard' }, { difficulty: 'easy' }],
    });

    const result = await engine.run();

    expect(result.error).toBeUndefined();
    // Difficulty is not echoed back in the result; the assertion that matters is that a mixed
    // table still completes a game rather than throwing on an unconfigured seat.
    expect(result.winner).not.toBeNull();
    expect(result.scores[0 as PlayerIndex]).toBeTypeOf('number');
  });
});
