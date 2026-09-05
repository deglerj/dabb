import { ref, set, remove, onValue, off, onDisconnect } from 'firebase/database';
import { db } from './config.js';
import type { PlayerCount } from '@dabb/shared-types';

/**
 * Lobby index — one entry per session that is still waiting for players.
 *
 * It exists because `sessions/$code` is only readable *by code*: a client that does not
 * already know a code cannot list anything, and opening `.read` on the `sessions` root
 * instead would hand every visitor every session's event log — and with it every player's
 * hand, since view filtering (`game-logic/src/state/views.ts`) is client-side only.
 *
 * So this node carries only what the list needs to render. It is writable by anyone, the
 * same trust level `presence` and `emotes` already sit at.
 */

/** Keep in sync with the stale-session delete rule in `database.rules.json`. */
export const LOBBY_TTL_MS = 3_600_000;

export interface LobbyEntry {
  code: string;
  /** Nickname of the player on seat 0. */
  host: string;
  playerCount: PlayerCount;
  /** Seats already taken, humans and bots alike. */
  taken: number;
  createdAt: number;
}

export function writeLobbyEntry(entry: LobbyEntry): Promise<void> {
  const { code, ...fields } = entry;
  return set(ref(db, `lobby/${code}`), fields);
}

/**
 * Same trick as `setupPresence`: a host who closes the tab takes the listing with them.
 *
 * Only the host registers this. A guest doing it too would delete the listing on leaving a
 * table the host is still sitting at.
 */
export function removeLobbyEntryOnDisconnect(code: string): Promise<void> {
  return onDisconnect(ref(db, `lobby/${code}`)).remove();
}

export function removeLobbyEntry(code: string): Promise<void> {
  return remove(ref(db, `lobby/${code}`));
}

type StoredEntry = Omit<LobbyEntry, 'code'>;

/** Entries younger than the TTL, newest first. */
export function toFreshEntries(raw: Record<string, StoredEntry> | null, now: number): LobbyEntry[] {
  return Object.entries(raw ?? {})
    .map(([code, fields]) => ({ code, ...fields }))
    .filter((entry) => now - entry.createdAt < LOBBY_TTL_MS)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Codes of entries the TTL has expired — what `pruneStaleSessions` is meant to be given. */
export function toStaleCodes(raw: Record<string, StoredEntry> | null, now: number): string[] {
  return Object.entries(raw ?? {})
    .filter(([, fields]) => now - fields.createdAt >= LOBBY_TTL_MS)
    .map(([code]) => code);
}

export function subscribeToLobby(
  callback: (entries: LobbyEntry[], staleCodes: string[]) => void
): () => void {
  const lobbyRef = ref(db, 'lobby');
  const handler = onValue(lobbyRef, (snap) => {
    const raw = snap.val() as Record<string, StoredEntry> | null;
    const now = Date.now();
    callback(toFreshEntries(raw, now), toStaleCodes(raw, now));
  });
  return () => off(lobbyRef, 'value', handler);
}

/**
 * Deletes sessions nobody ever started. There is no server, so whichever client opens the
 * lobby is the garbage collector; the rules only allow it for a `waiting` session older than
 * an hour, so a long-running game is safe. Failures are expected (another client got there
 * first) and ignored.
 */
export async function pruneStaleSessions(codes: string[]): Promise<void> {
  await Promise.all(
    codes.map(async (code) => {
      try {
        await remove(ref(db, `sessions/${code}`));
      } catch {
        // Rule rejected it, or someone else already removed it.
      }
      try {
        await removeLobbyEntry(code);
      } catch {
        // Same.
      }
    })
  );
}
