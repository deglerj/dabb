import { ref, push, update, onChildAdded, off, get } from 'firebase/database';
import { db } from './config.js';
import type { GameEvent } from '@dabb/shared-types';

export type StoredEvent = GameEvent & {
  authorHash: string;
};

export async function pushEvents(
  sessionCode: string,
  events: GameEvent[],
  authorHash: string
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const updates: Record<string, StoredEvent> = {};
  for (const event of events) {
    const newKey = push(ref(db, `sessions/${sessionCode}/events`)).key;
    if (!newKey) {
      throw new Error('Failed to generate Firebase key');
    }
    updates[`sessions/${sessionCode}/events/${newKey}`] = JSON.parse(
      JSON.stringify({ ...event, authorHash })
    ) as StoredEvent;
  }

  await update(ref(db), updates);
}

export function subscribeToEvents(
  sessionCode: string,
  onEvent: (event: GameEvent) => void
): () => void {
  const eventsRef = ref(db, `sessions/${sessionCode}/events`);

  const handler = onChildAdded(eventsRef, (snap) => {
    const stored = snap.val() as StoredEvent | null;
    if (!stored) {
      return;
    }
    const { authorHash: _a, ...event } = stored;
    onEvent(event as GameEvent);
  });

  return () => off(eventsRef, 'child_added', handler);
}

export async function getAllEvents(sessionCode: string): Promise<GameEvent[]> {
  const snapshot = await get(ref(db, `sessions/${sessionCode}/events`));
  if (!snapshot.exists()) {
    return [];
  }

  const events: GameEvent[] = [];
  snapshot.forEach((child) => {
    const stored = child.val() as StoredEvent;
    const { authorHash: _a, ...event } = stored;
    events.push(event as GameEvent);
  });

  return events.sort((a, b) => a.sequence - b.sequence);
}

export async function claimCascade(
  sessionCode: string,
  claimKey: string,
  claimerHash: string
): Promise<boolean> {
  const claimRef = ref(db, `sessions/${sessionCode}/aiClaims/${claimKey}`);
  const existing = await get(claimRef);

  if (existing.exists()) {
    const data = existing.val() as { claimedBy: string; claimedAt: number };
    const isExpired = Date.now() - data.claimedAt > 10_000;
    if (!isExpired) {
      return false;
    }
  }

  await update(claimRef, { claimedBy: claimerHash, claimedAt: Date.now() });

  const confirm = await get(claimRef);
  const winner = (confirm.val() as { claimedBy: string }).claimedBy;
  return winner === claimerHash;
}
