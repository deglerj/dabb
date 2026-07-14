import { ref, get, set, update, onDisconnect, onValue, off } from 'firebase/database';
import { db } from './config.js';
import { generateSessionCode } from './sessionCode.js';
import { getOrCreateSecretId, hashSecretId } from './secretId.js';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';

export interface SessionPlayer {
  nickname: string;
  secretHash: string | null;
  isAI: boolean;
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

  return { sessionCode, secretId, playerIndex: 0 as PlayerIndex };
}

export async function joinSession(
  sessionCode: string,
  nickname: string
): Promise<JoinSessionResult> {
  const code = sessionCode.trim().toLowerCase();
  const metaRef = ref(db, `sessions/${code}/meta`);
  const snapshot = await get(metaRef);

  if (!snapshot.exists()) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const meta = snapshot.val() as SessionMeta;

  if (meta.status !== 'waiting') {
    throw new Error('GAME_STARTED');
  }

  const takenSlots = Object.keys(meta.players).map(Number);
  let playerIndex: PlayerIndex | null = null;
  for (let i = 0; i < meta.playerCount; i++) {
    if (!takenSlots.includes(i)) {
      playerIndex = i as PlayerIndex;
      break;
    }
  }

  if (playerIndex === null) {
    throw new Error('SESSION_FULL');
  }

  const secretId = await getOrCreateSecretId(code);
  const secretHash = await hashSecretId(secretId);

  await set(ref(db, `sessions/${code}/meta/players/${playerIndex}`), {
    nickname,
    secretHash,
    isAI: false,
  });

  return { secretId, playerIndex };
}

export async function addAIPlayer(
  sessionCode: string,
  players: Record<string, SessionPlayer>,
  playerCount: PlayerCount,
  aiNickname: string
): Promise<PlayerIndex> {
  const takenSlots = Object.keys(players).map(Number);
  let playerIndex: PlayerIndex | null = null;
  for (let i = 0; i < playerCount; i++) {
    if (!takenSlots.includes(i)) {
      playerIndex = i as PlayerIndex;
      break;
    }
  }
  if (playerIndex === null) {
    throw new Error('SESSION_FULL');
  }

  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), {
    nickname: aiNickname,
    secretHash: null,
    isAI: true,
  });

  return playerIndex;
}

export async function removeAIPlayer(sessionCode: string, playerIndex: PlayerIndex): Promise<void> {
  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), null);
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
