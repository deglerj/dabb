import { ref, get, set, update, onDisconnect, onValue, off } from 'firebase/database';
import { db } from './config.js';
import { generateSessionCode } from './sessionCode.js';
import { getOrCreateSecretId, hashSecretId } from './secretId.js';
import { writeLobbyEntry, removeLobbyEntry, removeLobbyEntryOnDisconnect } from './lobby.js';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';
import { GameError, GAME_ERROR_CODES, availableAINames, sameNickname } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export interface SessionPlayer {
  nickname: string;
  secretHash: string | null;
  isAI: boolean;
  /** Only set for AI players; absent for humans and for AI added before this was stored. */
  aiDifficulty?: AIDifficulty;
}

export interface SessionMeta {
  playerCount: PlayerCount;
  targetScore: number;
  status: 'waiting' | 'active' | 'finished' | 'terminated';
  createdAt: number;
  players: Record<string, SessionPlayer>;
}

export interface CreateSessionResult {
  sessionCode: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

export interface JoinSessionResult {
  secretId: string;
  playerIndex: PlayerIndex;
}

export async function createSession(
  nickname: string,
  playerCount: PlayerCount,
  targetScore = 1000
): Promise<CreateSessionResult> {
  const sessionCode = generateSessionCode();
  const secretId = await getOrCreateSecretId(sessionCode);
  const secretHash = await hashSecretId(secretId);

  const meta: SessionMeta = {
    playerCount,
    targetScore,
    status: 'waiting',
    createdAt: Date.now(),
    players: {
      '0': { nickname, secretHash, isAI: false },
    },
  };

  await set(ref(db, `sessions/${sessionCode}/meta`), meta);
  await removeLobbyEntryOnDisconnect(sessionCode);
  await syncLobbyEntry(sessionCode);

  return { sessionCode, secretId, playerIndex: 0 as PlayerIndex };
}

/**
 * Republishes the lobby listing from whatever `meta` now says, or takes it down once the
 * table is full or the game has left `waiting`.
 *
 * Deliberately re-reads instead of taking the caller's `meta`: every caller holds a snapshot
 * from *before* its own seat write, and mirroring a seat count by hand is exactly the kind of
 * bookkeeping that drifts.
 */
async function syncLobbyEntry(sessionCode: string): Promise<void> {
  const meta = await getSessionMeta(sessionCode);
  if (!meta || meta.status !== 'waiting') {
    await removeLobbyEntry(sessionCode);
    return;
  }

  const taken = Object.keys(meta.players).length;
  if (taken >= meta.playerCount) {
    await removeLobbyEntry(sessionCode);
    return;
  }

  await writeLobbyEntry({
    code: sessionCode,
    host: meta.players['0']?.nickname ?? '',
    playerCount: meta.playerCount,
    taken,
    createdAt: meta.createdAt,
  });
}

/** The lowest seat nobody has taken, or null when the table is full. */
function firstFreeSeat(
  players: Record<string, unknown>,
  playerCount: PlayerCount
): PlayerIndex | null {
  for (let i = 0; i < playerCount; i++) {
    if (!(String(i) in players)) {
      return i as PlayerIndex;
    }
  }
  return null;
}

/**
 * Seats are claimed optimistically — read the table, pick the lowest free seat, write it — and
 * `meta/players/$playerIndex` accepts exactly one write, so the database, not this function,
 * decides who got there first. The loser is told no and simply tries the next seat.
 *
 * Two people racing for the same seat used to need them to type the same code in the same
 * second. From the lobby, "everyone taps the game at the top of the list" is the normal case.
 */
const MAX_SEAT_CLAIM_ATTEMPTS = 4;

/**
 * A bot may already carry this nickname — it was free when the host added it. The human keeps
 * the name they typed; the bot is the one that moves.
 */
async function renameClashingBot(
  code: string,
  players: Record<string, SessionPlayer>,
  nickname: string
): Promise<void> {
  const clashingSeat = Object.entries(players).find(
    ([, player]) => player.isAI && sameNickname(player.nickname, nickname)
  );
  if (!clashingSeat) {
    return;
  }
  const taken = [nickname, ...Object.values(players).map((p) => p.nickname)];
  const [freeName] = availableAINames(taken);
  if (freeName) {
    await set(ref(db, `sessions/${code}/meta/players/${clashingSeat[0]}/nickname`), freeName);
  }
}

export async function joinSession(
  sessionCode: string,
  nickname: string
): Promise<JoinSessionResult> {
  const code = sessionCode.trim().toLowerCase();
  const secretId = await getOrCreateSecretId(code);
  const secretHash = await hashSecretId(secretId);

  for (let attempt = 0; attempt < MAX_SEAT_CLAIM_ATTEMPTS; attempt++) {
    const snapshot = await get(ref(db, `sessions/${code}/meta`));

    if (!snapshot.exists()) {
      throw new GameError(GAME_ERROR_CODES.SESSION_NOT_FOUND);
    }

    const meta = snapshot.val() as SessionMeta;

    if (meta.status !== 'waiting') {
      throw new GameError(GAME_ERROR_CODES.GAME_ALREADY_STARTED);
    }

    const playerIndex = firstFreeSeat(meta.players, meta.playerCount);
    if (playerIndex === null) {
      throw new GameError(GAME_ERROR_CODES.SESSION_FULL);
    }

    try {
      await set(ref(db, `sessions/${code}/meta/players/${playerIndex}`), {
        nickname,
        secretHash,
        isAI: false,
      });
    } catch {
      // Somebody claimed this seat between the read and the write. Read again, take the next.
      continue;
    }

    await renameClashingBot(code, meta.players, nickname);
    await syncLobbyEntry(code);

    return { secretId, playerIndex };
  }

  throw new GameError(GAME_ERROR_CODES.SESSION_FULL);
}

export async function addAIPlayer(
  sessionCode: string,
  players: Record<string, SessionPlayer>,
  playerCount: PlayerCount,
  aiNickname: string,
  aiDifficulty: AIDifficulty
): Promise<PlayerIndex> {
  const playerIndex = firstFreeSeat(players, playerCount);
  if (playerIndex === null) {
    throw new GameError(GAME_ERROR_CODES.SESSION_FULL);
  }

  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), {
    nickname: aiNickname,
    secretHash: null,
    isAI: true,
    aiDifficulty,
  });
  await syncLobbyEntry(sessionCode);

  return playerIndex;
}

export async function removeAIPlayer(sessionCode: string, playerIndex: PlayerIndex): Promise<void> {
  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), null);
  await syncLobbyEntry(sessionCode);
}

export async function getSessionMeta(sessionCode: string): Promise<SessionMeta | null> {
  const snapshot = await get(ref(db, `sessions/${sessionCode}/meta`));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.val() as SessionMeta;
}

export async function setSessionStatus(
  sessionCode: string,
  status: SessionMeta['status']
): Promise<void> {
  await update(ref(db, `sessions/${sessionCode}/meta`), { status });
  // Started, finished or aborted — either way it has no business in the lobby any more. Done
  // here rather than at the call sites so no future one has to remember.
  if (status !== 'waiting') {
    await removeLobbyEntry(sessionCode);
  }
}

export function setupPresence(sessionCode: string, playerIndex: PlayerIndex): () => void {
  const presenceRef = ref(db, `sessions/${sessionCode}/presence/${playerIndex}`);
  const connectedRef = ref(db, '.info/connected');

  const handler = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      void set(presenceRef, { connected: true, lastSeen: Date.now() });
      onDisconnect(presenceRef).set({ connected: false, lastSeen: Date.now() });
    }
  });

  return () => {
    off(connectedRef, 'value', handler);
    void set(presenceRef, { connected: false, lastSeen: Date.now() });
  };
}

export function subscribeToPlayers(
  sessionCode: string,
  callback: (players: Record<string, SessionPlayer>) => void
): () => void {
  const playersRef = ref(db, `sessions/${sessionCode}/meta/players`);
  const handler = onValue(playersRef, (snap) => {
    callback((snap.val() as Record<string, SessionPlayer>) ?? {});
  });
  return () => off(playersRef, 'value', handler);
}

/**
 * Live connection state per seat, written by every client's own setupPresence.
 *
 * A seat with no presence entry yet reports false — that is a human who has not opened the
 * game screen. AI seats never write presence at all, so callers have to treat them
 * separately rather than reading them as disconnected.
 */
export function subscribeToPresence(
  sessionCode: string,
  callback: (connected: Map<PlayerIndex, boolean>) => void
): () => void {
  const presenceRef = ref(db, `sessions/${sessionCode}/presence`);
  const handler = onValue(presenceRef, (snap) => {
    const raw = (snap.val() as Record<string, { connected?: boolean }> | null) ?? {};
    const map = new Map<PlayerIndex, boolean>();
    for (const [idx, entry] of Object.entries(raw)) {
      map.set(Number(idx) as PlayerIndex, entry?.connected === true);
    }
    callback(map);
  });
  return () => off(presenceRef, 'value', handler);
}

export function subscribeToSessionStatus(
  sessionCode: string,
  callback: (status: SessionMeta['status']) => void
): () => void {
  const statusRef = ref(db, `sessions/${sessionCode}/meta/status`);
  const handler = onValue(statusRef, (snap) => {
    if (snap.exists()) {
      callback(snap.val() as SessionMeta['status']);
    }
  });
  return () => off(statusRef, 'value', handler);
}
