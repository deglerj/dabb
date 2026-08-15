/**
 * Tests for the per-seat AI config.
 *
 * Without it every seat gets an identical bot, and a change to the AI cannot be measured at all
 * — which is how the going-out threshold sat 3.5x too high for as long as it did.
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { SimulationEngine } from '../simulation/SimulationEngine.js';

describe('per-seat AI config', () => {
  it('reports the difficulty that sat in each seat', async () => {
    const engine = new SimulationEngine({
      sessionId: 'seat-config',
      playerCount: 2,
      targetScore: 200,
      maxActions: 5000,
      timeoutMs: 30000,
      seats: [{ difficulty: 'hard' }, { difficulty: 'easy' }],
    });

    const result = await engine.run();

    expect(result.error).toBeUndefined();
    expect(result.seatDifficulties).toEqual(['hard', 'easy']);
  });

  it('falls back to the table-wide difficulty when no seats are given', async () => {
    const engine = new SimulationEngine({
      sessionId: 'seat-config-default',
      playerCount: 2,
      targetScore: 200,
      maxActions: 5000,
      timeoutMs: 30000,
      difficulty: 'hard',
    });

    const result = await engine.run();

    expect(result.error).toBeUndefined();
    expect(result.seatDifficulties).toEqual(['hard', 'hard']);
  });

  it('plays a mixed table through to a winner', async () => {
    const results = await Promise.all(
      [0, 1, 2, 3].map((gameIndex) =>
        new SimulationEngine({
          sessionId: `mixed-${gameIndex}`,
          playerCount: 2,
          targetScore: 300,
          maxActions: 5000,
          timeoutMs: 30000,
          // Rotated the way the runner rotates it, so both seats see both bots.
          seats:
            gameIndex % 2 === 0
              ? [{ difficulty: 'hard' as const }, { difficulty: 'easy' as const }]
              : [{ difficulty: 'easy' as const }, { difficulty: 'hard' as const }],
        }).run()
      )
    );

    for (const result of results) {
      expect(result.error).toBeUndefined();
      expect(result.winner).not.toBeNull();
      expect(result.seatDifficulties).toHaveLength(2);
      expect(result.scores[0 as PlayerIndex]).toBeTypeOf('number');
    }
  });
});
