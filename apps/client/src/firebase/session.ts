import { ref, get, set, update, onDisconnect, onValue, off } from 'firebase/database';
import { db } from './config.js';
import { ensureAuthenticated } from './auth.js';
import { generateSessionCode } from './sessionCode.js';
import { writeLobbyEntry, removeLobbyEntry, removeLobbyEntryOnDisconnect } from './lobby.js';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';
import { GameError, GAME_ERROR_CODES, availableAINames, sameNickname } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export interface SessionPlayer {
  nickname: string;
  /** Firebase Auth identity of a human seat; AI seats have no owner. */
  ownerUid?: string;
  /** Legacy field, accepted only when reading pre-cutover data. */
  secretHash?: string | null;
  isAI: boolean;
  /** Only set for AI players; absent for humans and for AI added before this was stored. */
  aiDifficulty?: AIDifficulty;
  /**
   * Set by a human who left the waiting room. The seat stays in `meta` — `meta/players/$i`
   * cannot be deleted, and letting anyone delete it would let anyone throw anyone else out —
   * so the record is kept and marked instead. Everything that counts seats treats it as free.
   */
  left?: boolean;
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
  ownerUid: string;
  playerIndex: PlayerIndex;
}

export interface JoinSessionResult {
  ownerUid: string;
  playerIndex: PlayerIndex;
}

export async function createSession(
  nickname: string,
  playerCount: PlayerCount,
  targetScore = 1000
): Promise<CreateSessionResult> {
  const user = await ensureAuthenticated();
  const sessionCode = generateSessionCode();

  const meta: SessionMeta = {
    playerCount,
    targetScore,
    status: 'waiting',
    createdAt: Date.now(),
    players: {
      '0': { nickname, ownerUid: user.uid, isAI: false },
    },
  };

  await set(ref(db, `sessions/${sessionCode}/meta`), meta);
  await writeJoinProjection(sessionCode, meta);
  await removeLobbyEntryOnDisconnect(sessionCode);
  await syncLobbyEntry(sessionCode);

  return { sessionCode, ownerUid: user.uid, playerIndex: 0 as PlayerIndex };
}

interface SessionJoinProjection {
  schemaVersion: 2;
  playerCount: PlayerCount;
  status: SessionMeta['status'];
  createdAt: number;
  players: Record<string, Pick<SessionPlayer, 'nickname' | 'isAI' | 'left'>>;
}

function toJoinProjection(meta: SessionMeta): SessionJoinProjection {
  const players: SessionJoinProjection['players'] = {};
  for (const [index, player] of Object.entries(meta.players)) {
    players[index] = {
      nickname: player.nickname,
      isAI: player.isAI,
      ...(player.left ? { left: true } : {}),
    };
  }
  return {
    schemaVersion: 2,
    playerCount: meta.playerCount,
    status: meta.status,
    createdAt: meta.createdAt,
    players,
  };
}

async function writeJoinProjection(sessionCode: string, meta: SessionMeta): Promise<void> {
  await set(ref(db, `sessions/${sessionCode}/join`), toJoinProjection(meta));
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

  await writeJoinProjection(sessionCode, meta);

  const taken = Object.values(meta.players).filter((player) => !player.left).length;
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

/** The lowest seat nobody holds — never written, or vacated by the human who held it. */
function firstFreeSeat(
  players: Record<string, SessionPlayer | undefined>,
  playerCount: PlayerCount
): PlayerIndex | null {
  for (let i = 0; i < playerCount; i++) {
    const player = players[String(i)];
    if (!player || player.left) {
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
  const user = await ensureAuthenticated();

  for (let attempt = 0; attempt < MAX_SEAT_CLAIM_ATTEMPTS; attempt++) {
    const snapshot = await get(ref(db, `sessions/${code}/join`));

    if (!snapshot.exists()) {
      throw new GameError(GAME_ERROR_CODES.SESSION_NOT_FOUND);
    }

    const projection = snapshot.val() as SessionJoinProjection;
    if (projection.schemaVersion !== 2) {
      throw new GameError(GAME_ERROR_CODES.SESSION_NOT_FOUND);
    }

    if (projection.status !== 'waiting') {
      throw new GameError(GAME_ERROR_CODES.GAME_ALREADY_STARTED);
    }

    const playerIndex = firstFreeSeat(projection.players, projection.playerCount);
    if (playerIndex === null) {
      throw new GameError(GAME_ERROR_CODES.SESSION_FULL);
    }

    try {
      await set(ref(db, `sessions/${code}/meta/players/${playerIndex}`), {
        nickname,
        ownerUid: user.uid,
        isAI: false,
      });
    } catch {
      // Somebody claimed this seat between the read and the write. Read again, take the next.
      continue;
    }

    await renameClashingBot(code, projection.players, nickname);
    await syncLobbyEntry(code);

    return { ownerUid: user.uid, playerIndex };
  }

  throw new GameError(GAME_ERROR_CODES.SESSION_FULL);
}

/**
 * Vacates a seat in a waiting room, so the table stops showing someone who walked away.
 *
 * The seat is marked rather than deleted. The authenticated seat owner is the proof the rules
 * check, so only that owner can vacate it. Deleting instead would need a rule anyone could use
 * on anyone.
 *
 * The host leaving takes the listing down with it: nobody else can start that session, so a
 * lobby entry for it would only send people to a table that can never begin.
 */
export async function leaveSession(
  sessionCode: string,
  playerIndex: PlayerIndex,
  player: SessionPlayer
): Promise<void> {
  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), {
    ...player,
    left: true,
  });

  if (playerIndex === 0) {
    await removeLobbyEntry(sessionCode);
    return;
  }
  await syncLobbyEntry(sessionCode);
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
  await ensureAuthenticated();
  const snapshot = await get(ref(db, `sessions/${sessionCode}/meta`));
  if (!snapshot.exists()) {
    return null;
  }
  const meta = snapshot.val() as SessionMeta;
  const hasLegacyHuman = Object.values(meta.players).some(
    (player) => !player.isAI && !player.ownerUid
  );
  return hasLegacyHuman ? null : meta;
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
    await set(ref(db, `sessions/${sessionCode}/join`), null);
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
