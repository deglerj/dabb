import { ref, set, onValue, off } from 'firebase/database';
import { db } from './config.js';
import { generateSessionCode } from './sessionCode.js';
import { getOrCreateSecretId, hashSecretId } from './secretId.js';
import type { SessionMeta, SessionPlayer } from './session.js';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

/**
 * Rematch transport — a side channel per session, never events.
 *
 * A rematch vote is ephemeral coordination, not game state: in the append-only log it would
 * replay on every reconnect and travel through the reducer, the view filter and the game log
 * for nothing. It sits next to `emotes` and `presence`, at the same trust level.
 *
 * The rematch itself is a *new* session with the same seats rather than a restart of this
 * one. That leaves the finished game's log intact, needs no rule that lets anyone overwrite
 * `events`, and gets seat preservation for free: `meta/players/$i` is writable exactly once,
 * so every player claims their own seat with their own secret hash.
 */

export interface RematchSignal {
  /** Seat index (as a string) to answer. Seats that have not answered are absent. */
  votes: Record<string, boolean>;
  /** The rematch session's code, published by the host once it exists. */
  code?: string;
}

/** A seat carried over into the rematch, exactly as it sat in the finished game. */
export interface RematchSeat {
  playerIndex: PlayerIndex;
  nickname: string;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
}

export function sendRematchVote(
  sessionCode: string,
  playerIndex: PlayerIndex,
  agree: boolean
): Promise<void> {
  return set(ref(db, `sessions/${sessionCode}/rematch/votes/${playerIndex}`), agree);
}

export function publishRematchCode(sessionCode: string, rematchCode: string): Promise<void> {
  return set(ref(db, `sessions/${sessionCode}/rematch/code`), rematchCode);
}

export function subscribeToRematch(
  sessionCode: string,
  callback: (signal: RematchSignal) => void
): () => void {
  const rematchRef = ref(db, `sessions/${sessionCode}/rematch`);
  const handler = onValue(rematchRef, (snap) => {
    const raw: RematchSignal = (snap.val() as RematchSignal | null) ?? { votes: {} };
    callback({ votes: raw.votes ?? {}, ...(raw.code ? { code: raw.code } : {}) });
  });
  return () => off(rematchRef, 'value', handler);
}

function credentialsKey(sessionCode: string): string {
  return `dabb-${sessionCode}`;
}

/**
 * Creates the rematch session, seated with the host and every bot.
 *
 * The other humans are left out on purpose — only they can hash their own secret, and
 * `claimRematchSeat` is what puts them in. The session is born `active` rather than
 * `waiting`: those seats stand empty for a moment, and an outsider who guessed the fresh
 * code could otherwise `joinSession` into one before its owner arrives.
 */
export async function createRematchSession(
  seats: RematchSeat[],
  hostIndex: PlayerIndex,
  playerCount: PlayerCount,
  targetScore: number
): Promise<{ code: string; secretHash: string }> {
  const code = generateSessionCode();
  const secretId = await getOrCreateSecretId(code);
  const secretHash = await hashSecretId(secretId);

  const players: Record<string, SessionPlayer> = {};
  for (const seat of seats) {
    if (seat.isAI) {
      players[String(seat.playerIndex)] = {
        nickname: seat.nickname,
        secretHash: null,
        isAI: true,
        ...(seat.aiDifficulty ? { aiDifficulty: seat.aiDifficulty } : {}),
      };
    }
  }
  const host = seats.find((seat) => seat.playerIndex === hostIndex);
  players[String(hostIndex)] = {
    nickname: host?.nickname ?? '',
    secretHash,
    isAI: false,
  };

  const meta: SessionMeta = {
    playerCount,
    targetScore,
    status: 'active',
    createdAt: Date.now(),
    players,
  };
  await set(ref(db, `sessions/${code}/meta`), meta);

  localStorage.setItem(
    credentialsKey(code),
    JSON.stringify({ secretId, playerIndex: hostIndex, playerCount })
  );

  return { code, secretHash };
}

/**
 * Takes the same seat in the rematch session and stores the credentials for it.
 *
 * A no-op once credentials exist — the host seated itself while creating the session, and
 * `meta/players/$i` only accepts one write anyway.
 */
export async function claimRematchSeat(
  rematchCode: string,
  playerIndex: PlayerIndex,
  nickname: string
): Promise<void> {
  if (localStorage.getItem(credentialsKey(rematchCode))) {
    return;
  }

  const secretId = await getOrCreateSecretId(rematchCode);
  const secretHash = await hashSecretId(secretId);

  await set(ref(db, `sessions/${rematchCode}/meta/players/${playerIndex}`), {
    nickname,
    secretHash,
    isAI: false,
  });

  localStorage.setItem(credentialsKey(rematchCode), JSON.stringify({ secretId, playerIndex }));
}
