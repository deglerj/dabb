import { ref, push, update, onChildAdded, off, get, runTransaction } from 'firebase/database';
import { db } from './config.js';
import { ensureAuthenticated } from './auth.js';
import type { GameEvent, PlayerIndex } from '@dabb/shared-types';
import { normalizeEventLog } from '@dabb/game-logic';

export interface AIClaim {
  playerIndex: PlayerIndex;
  claimedBy: string;
  claimedAt: number;
}

export async function pushEvents(sessionCode: string, events: GameEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await ensureAuthenticated();

  const updates: Record<string, GameEvent> = {};
  for (const event of events) {
    const newKey = push(ref(db, `sessions/${sessionCode}/events`)).key;
    if (!newKey) {
      throw new Error('Failed to generate Firebase key');
    }
    updates[`sessions/${sessionCode}/events/${newKey}`] = JSON.parse(
      JSON.stringify(event)
    ) as GameEvent;
  }

  await update(ref(db), updates);
}

export function subscribeToEvents(
  sessionCode: string,
  onEvent: (event: GameEvent) => void
): () => void {
  const eventsRef = ref(db, `sessions/${sessionCode}/events`);

  const handler = onChildAdded(eventsRef, (snap) => {
    const event = snap.val() as GameEvent | null;
    if (event) {
      onEvent(event);
    }
  });

  return () => off(eventsRef, 'child_added', handler);
}

export async function getAllEvents(sessionCode: string): Promise<GameEvent[]> {
  await ensureAuthenticated();
  const snapshot = await get(ref(db, `sessions/${sessionCode}/events`));
  if (!snapshot.exists()) {
    return [];
  }

  const events: GameEvent[] = [];
  snapshot.forEach((child) => {
    events.push(child.val() as GameEvent);
  });

  return normalizeEventLog(events);
}

/**
 * Atomically claim one AI decision. Any authenticated member may win a free or expired claim;
 * the database rules bind the eventual events to the same AI seat and claim id.
 */
export async function claimCascade(
  sessionCode: string,
  claimId: string,
  playerIndex: PlayerIndex
): Promise<boolean> {
  const user = await ensureAuthenticated();
  const claimRef = ref(db, `sessions/${sessionCode}/aiClaims/${claimId}`);
  const now = Date.now();

  const result = await runTransaction(claimRef, (value) => {
    const existing = value as AIClaim | null;
    if (existing && existing.claimedBy !== user.uid && now - existing.claimedAt <= 10_000) {
      return;
    }
    return { playerIndex, claimedBy: user.uid, claimedAt: Date.now() } satisfies AIClaim;
  });

  const claim = result.snapshot.val() as AIClaim | null;
  return (
    result.committed === true && claim?.claimedBy === user.uid && claim.playerIndex === playerIndex
  );
}
