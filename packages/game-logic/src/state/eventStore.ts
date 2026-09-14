import type { GameEvent, GameState } from '@dabb/shared-types';
import { applyEvent, applyEvents } from './reducer.js';
import { createInitialState } from './initial.js';
import { analyzeEventLog } from './eventLog.js';

export type EventStoreStatus = 'applied' | 'duplicate' | 'buffered' | 'resync-required' | 'invalid';

export interface EventStoreResult {
  status: EventStoreStatus;
  events: GameEvent[];
  state: GameState;
  newlyApplied: GameEvent[];
  missingSequences: number[];
  conflictingSequences: number[];
}

/** Canonical, incrementally reduced event log. */
export class EventStore {
  private events: GameEvent[] = [];
  private state: GameState;
  private readonly pending = new Map<string, GameEvent>();
  private readonly eventIds = new Set<string>();
  private readonly initialPlayerCount: 2 | 3 | 4;

  constructor(initialPlayerCount: 2 | 3 | 4 = 4) {
    this.initialPlayerCount = initialPlayerCount;
    this.state = createInitialState(initialPlayerCount);
  }

  replaceSnapshot(snapshot: GameEvent[]): EventStoreResult {
    const analysis = analyzeEventLog(snapshot);
    if (!analysis.isContiguous) {
      return this.result(
        analysis.invalidSequences.length > 0 ? 'invalid' : 'resync-required',
        [],
        analysis.missingSequences,
        analysis.conflictingSequences
      );
    }

    this.events = analysis.events;
    this.eventIds.clear();
    for (const event of this.events) {
      this.eventIds.add(event.id);
    }
    this.pending.clear();
    this.state = applyEvents(this.events, createInitialState(this.initialPlayerCount));
    return this.result('applied', this.events, [], []);
  }

  accept(event: GameEvent): EventStoreResult {
    if (this.eventIds.has(event.id) || this.pending.has(event.id)) {
      return this.result('duplicate', [], [], []);
    }
    if (!Number.isInteger(event.sequence) || event.sequence < 1) {
      return this.result('invalid', [], [], []);
    }

    const expected = this.events.length + 1;
    const pendingConflict = [...this.pending.values()].some(
      (pendingEvent) => pendingEvent.sequence === event.sequence
    );
    if (pendingConflict) {
      return this.result('resync-required', [], [], [event.sequence]);
    }
    if (event.sequence > expected) {
      this.pending.set(event.id, event);
      return this.result(
        'buffered',
        [],
        Array.from({ length: event.sequence - expected }, (_, i) => expected + i),
        []
      );
    }
    if (event.sequence < expected) {
      return this.result('resync-required', [], [], []);
    }

    const sameSequence = this.events.find((existing) => existing.sequence === event.sequence);
    if (sameSequence) {
      return this.result('resync-required', [], [], [event.sequence]);
    }

    const newlyApplied = [event];
    this.events = [...this.events, event];
    this.eventIds.add(event.id);
    this.state = applyEvent(this.state, event);

    let next = this.events.length + 1;
    while (true) {
      const pendingEvent = [...this.pending.values()].find(
        (candidate) => candidate.sequence === next
      );
      if (!pendingEvent) {
        break;
      }
      this.pending.delete(pendingEvent.id);
      this.events = [...this.events, pendingEvent];
      this.eventIds.add(pendingEvent.id);
      this.state = applyEvent(this.state, pendingEvent);
      newlyApplied.push(pendingEvent);
      next++;
    }
    return this.result('applied', newlyApplied, [], []);
  }

  getEvents(): GameEvent[] {
    return [...this.events];
  }

  getState(): GameState {
    return this.state;
  }

  private result(
    status: EventStoreStatus,
    newlyApplied: GameEvent[],
    missingSequences: number[],
    conflictingSequences: number[]
  ): EventStoreResult {
    return {
      status,
      events: [...this.events],
      state: this.state,
      newlyApplied,
      missingSequences,
      conflictingSequences,
    };
  }
}

export function createEventStore(initialPlayerCount: 2 | 3 | 4 = 4): EventStore {
  return new EventStore(initialPlayerCount);
}
