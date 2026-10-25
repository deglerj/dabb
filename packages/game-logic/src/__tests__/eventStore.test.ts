import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@dabb/shared-types';
import { applyEvents } from '../state/reducer.js';
import { EventStore } from '../state/eventStore.js';

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

describe('EventStore', () => {
  it('normalizes an initial snapshot and applies it once', () => {
    const store = new EventStore();
    const first = event(1, 'a');
    const second = event(2, 'b');

    const result = store.replaceSnapshot([second, first, first]);

    expect(result.status).toBe('applied');
    expect(store.getEvents()).toEqual([first, second]);
    expect(store.getState()).toEqual(applyEvents([first, second]));
  });

  it('applies contiguous events incrementally and ignores duplicates', () => {
    const store = new EventStore();
    const first = event(1, 'a');
    const second = event(2, 'b');

    expect(store.replaceSnapshot([first]).status).toBe('applied');
    expect(store.accept(second)).toMatchObject({ status: 'applied', newlyApplied: [second] });
    expect(store.accept(second).status).toBe('duplicate');
    expect(store.getState()).toEqual(applyEvents([first, second]));
  });

  it('buffers a gap and drains it when the missing event arrives', () => {
    const store = new EventStore();
    const first = event(1, 'a');
    const second = event(2, 'b');
    const third = event(3, 'c');

    store.replaceSnapshot([first]);
    expect(store.accept(third).status).toBe('buffered');
    const result = store.accept(second);

    expect(result).toMatchObject({ status: 'applied', newlyApplied: [second, third] });
    expect(store.getEvents()).toEqual([first, second, third]);
  });

  it('replaces local state with the canonical snapshot after reconnect', () => {
    const store = new EventStore();
    const first = event(1, 'a');
    const second = event(2, 'b');
    const third = event(3, 'c');

    store.replaceSnapshot([first]);
    expect(store.accept(third).status).toBe('buffered');
    expect(store.accept(second).status).toBe('applied');

    const result = store.replaceSnapshot([third, first, second, second]);

    expect(result.status).toBe('applied');
    expect(store.getEvents()).toEqual([first, second, third]);
    expect(store.getState()).toEqual(applyEvents([first, second, third]));
  });

  it('rejects incomplete or conflicting snapshots', () => {
    const store = new EventStore();
    const first = event(1, 'a');

    expect(store.replaceSnapshot([first, event(3, 'c')]).status).toBe('resync-required');
    expect(store.replaceSnapshot([first, event(2, 'b'), event(2, 'c')]).status).toBe(
      'resync-required'
    );
    expect(store.getEvents()).toEqual([]);
  });
});
