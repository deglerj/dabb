import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@dabb/shared-types';
import { analyzeEventLog, normalizeEventLog } from '../state/eventLog.js';

function event(sequence: number, id: string): GameEvent {
  return {
    id,
    sessionId: 'session',
    sequence,
    timestamp: sequence,
    type: 'GAME_TERMINATED',
    payload: { terminatedBy: 0, reason: 'player_exit' },
  };
}

describe('event log contract', () => {
  it('sorts by sequence and ignores duplicate deliveries', () => {
    const first = event(1, 'a');
    const second = event(2, 'b');

    expect(normalizeEventLog([second, first, first])).toEqual([first, second]);
    expect(analyzeEventLog([second, first, first])).toMatchObject({
      duplicateIds: ['a'],
      missingSequences: [],
      conflictingSequences: [],
      invalidSequences: [],
      isContiguous: true,
      nextSequence: 3,
    });
  });

  it('reports a gap instead of compacting late events', () => {
    const result = analyzeEventLog([event(3, 'c'), event(1, 'a')]);

    expect(result.events.map(({ sequence }) => sequence)).toEqual([1, 3]);
    expect(result.missingSequences).toEqual([2]);
    expect(result.isContiguous).toBe(false);
  });

  it('reports two different events with one sequence as a conflict', () => {
    const result = analyzeEventLog([event(2, 'b'), event(1, 'a'), event(2, 'c')]);

    expect(result.conflictingSequences).toEqual([2]);
    expect(result.isContiguous).toBe(false);
  });

  it('rejects non-positive and non-integer sequence values', () => {
    const result = analyzeEventLog([event(0, 'zero'), event(1.5, 'fraction')]);

    expect(result.invalidSequences).toEqual([0, 1.5]);
    expect(result.isContiguous).toBe(false);
  });
});
