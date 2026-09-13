import type { GameEvent } from '@dabb/shared-types';

export interface EventLogAnalysis {
  events: GameEvent[];
  duplicateIds: string[];
  missingSequences: number[];
  conflictingSequences: number[];
  invalidSequences: number[];
  isContiguous: boolean;
  nextSequence: number;
}

/**
 * Return the canonical order for an event collection.
 *
 * Sequence is the protocol ordering key. Event IDs are only a delivery
 * deduplication key; the first copy wins when a callback delivers an ID more
 * than once. The ID tie-breaker keeps malformed same-sequence input stable
 * until the caller can resynchronize it.
 */
export function normalizeEventLog(events: GameEvent[]): GameEvent[] {
  const seenIds = new Set<string>();
  return events
    .filter((event) => {
      if (seenIds.has(event.id)) {
        return false;
      }
      seenIds.add(event.id);
      return true;
    })
    .sort((a, b) => a.sequence - b.sequence || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Inspect an event collection against the canonical contiguous-log contract.
 * Missing or conflicting sequences require a full-log resynchronization; they
 * must not be made contiguous by changing an event's sequence number.
 */
export function analyzeEventLog(events: GameEvent[]): EventLogAnalysis {
  const normalized = normalizeEventLog(events);
  const duplicateIds: string[] = [];
  const duplicateIdSet = new Set<string>();
  const ids = new Set<string>();
  const sequences = new Map<number, Set<string>>();

  for (const event of events) {
    if (ids.has(event.id) && !duplicateIdSet.has(event.id)) {
      duplicateIds.push(event.id);
      duplicateIdSet.add(event.id);
    }
    ids.add(event.id);
    const sequenceIds = sequences.get(event.sequence) ?? new Set<string>();
    sequenceIds.add(event.id);
    sequences.set(event.sequence, sequenceIds);
  }

  const maxSequence = normalized.at(-1)?.sequence ?? 0;
  const missingSequences: number[] = [];
  for (let sequence = 1; sequence <= maxSequence; sequence++) {
    if (!sequences.has(sequence)) {
      missingSequences.push(sequence);
    }
  }

  const conflictingSequences = [...sequences.entries()]
    .filter(([, sequenceIds]) => sequenceIds.size > 1)
    .map(([sequence]) => sequence)
    .sort((a, b) => a - b);
  const invalidSequences = normalized
    .filter(({ sequence }) => !Number.isInteger(sequence) || sequence < 1)
    .map(({ sequence }) => sequence);

  return {
    events: normalized,
    duplicateIds,
    missingSequences,
    conflictingSequences,
    invalidSequences,
    isContiguous:
      missingSequences.length === 0 &&
      conflictingSequences.length === 0 &&
      invalidSequences.length === 0,
    nextSequence: maxSequence + 1,
  };
}
