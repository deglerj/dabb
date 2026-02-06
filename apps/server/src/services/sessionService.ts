import { v4 as uuidv4 } from 'uuid';
import type { PlayerCount, PlayerIndex, SessionStatus, Team } from '@dabb/shared-types';
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

import { pool } from '../db/pool.js';
import { generateSessionCode } from '../utils/sessionCode.js';

export type { SessionStatus };

export interface Session {
  id: string;
  code: string;
  playerCount: PlayerCount;
  status: SessionStatus;
  targetScore: number;
  createdAt: Date;
}

export interface Player {
  id: string;
  sessionId: string;
  secretId: string | null;
  nickname: string;
  playerIndex: PlayerIndex;
  team?: Team;
  connected: boolean;
  isAI: boolean;
}

// German boomer generation first names for AI players
export const AI_NAMES = [
  'Hans',
  'Greta',
  'Helga',
  'Werner',
  'Ingrid',
  'Horst',
  'Gerda',
  'Klaus',
  'Irmgard',
  'Günther',
  'Hildegard',
  'Dieter',
  'Ursula',
  'Manfred',
  'Erika',
  'Siegfried',
  'Renate',
  'Wolfgang',
  'Brigitte',
  'Helmut',
  'Christa',
  'Rolf',
  'Elfriede',
  'Heinz',
  'Lieselotte',
] as const;

export async function createSession(
  playerCount: PlayerCount,
  targetScore: number,
  hostNickname: string
): Promise<{ session: Session; player: Player }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate unique session code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateSessionCode();
      const existing = await client.query('SELECT id FROM sessions WHERE code = $1', [code]);
      if (existing.rows.length === 0) {
        break;
      }
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_CODE_GENERATION_FAILED);
    }

    // Create session
    const sessionResult = await client.query(
      `INSERT INTO sessions (code, player_count, target_score)
       VALUES ($1, $2, $3)
       RETURNING id, code, player_count, status, target_score, created_at`,
      [code, playerCount, targetScore]
    );

    const session: Session = {
      id: sessionResult.rows[0].id,
      code: sessionResult.rows[0].code,
      playerCount: sessionResult.rows[0].player_count,
      status: sessionResult.rows[0].status,
      targetScore: sessionResult.rows[0].target_score,
      createdAt: sessionResult.rows[0].created_at,
    };

    // Create host player
    const secretId = uuidv4();
    const playerResult = await client.query(
      `INSERT INTO players (session_id, secret_id, nickname, player_index, team)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, session_id, secret_id, nickname, player_index, team, connected, is_ai`,
      [session.id, secretId, hostNickname, 0, playerCount === 4 ? 0 : null]
    );

    const player: Player = {
      id: playerResult.rows[0].id,
      sessionId: playerResult.rows[0].session_id,
      secretId: playerResult.rows[0].secret_id,
      nickname: playerResult.rows[0].nickname,
      playerIndex: playerResult.rows[0].player_index,
      team: playerResult.rows[0].team ?? undefined,
      connected: playerResult.rows[0].connected,
      isAI: playerResult.rows[0].is_ai,
    };

    await client.query('COMMIT');

    return { session, player };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const result = await pool.query(
    `SELECT id, code, player_count, status, target_score, created_at
     FROM sessions WHERE code = $1`,
    [code]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    code: result.rows[0].code,
    playerCount: result.rows[0].player_count,
    status: result.rows[0].status,
    targetScore: result.rows[0].target_score,
    createdAt: result.rows[0].created_at,
  };
}

export async function getSessionById(id: string): Promise<Session | null> {
  const result = await pool.query(
    `SELECT id, code, player_count, status, target_score, created_at
     FROM sessions WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    code: result.rows[0].code,
    playerCount: result.rows[0].player_count,
    status: result.rows[0].status,
    targetScore: result.rows[0].target_score,
    createdAt: result.rows[0].created_at,
  };
}

export async function joinSession(sessionId: string, nickname: string): Promise<Player> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get session info
    const sessionResult = await client.query(
      'SELECT player_count, status FROM sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
    }

    const { player_count: playerCount, status } = sessionResult.rows[0];

    if (status !== 'waiting') {
      throw new GameError(SERVER_ERROR_CODES.GAME_ALREADY_STARTED);
    }

    // Get current players
    const playersResult = await client.query(
      'SELECT player_index FROM players WHERE session_id = $1',
      [sessionId]
    );

    if (playersResult.rows.length >= playerCount) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_FULL);
    }

    // Find next available player index
    const usedIndices = new Set(playersResult.rows.map((r) => r.player_index));
    let playerIndex: PlayerIndex = 0;
    while (usedIndices.has(playerIndex)) {
      playerIndex = (playerIndex + 1) as PlayerIndex;
    }

    // Determine team for 4-player games
    const team = playerCount === 4 ? ((playerIndex % 2) as Team) : null;

    // Create player
    const secretId = uuidv4();
    const playerResult = await client.query(
      `INSERT INTO players (session_id, secret_id, nickname, player_index, team)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, session_id, secret_id, nickname, player_index, team, connected, is_ai`,
      [sessionId, secretId, nickname, playerIndex, team]
    );

    await client.query('COMMIT');

    return {
      id: playerResult.rows[0].id,
      sessionId: playerResult.rows[0].session_id,
      secretId: playerResult.rows[0].secret_id,
      nickname: playerResult.rows[0].nickname,
      playerIndex: playerResult.rows[0].player_index,
      team: playerResult.rows[0].team ?? undefined,
      connected: playerResult.rows[0].connected,
      isAI: playerResult.rows[0].is_ai,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlayerBySecretId(secretId: string): Promise<Player | null> {
  const result = await pool.query(
    `SELECT id, session_id, secret_id, nickname, player_index, team, connected, is_ai
     FROM players WHERE secret_id = $1`,
    [secretId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    sessionId: result.rows[0].session_id,
    secretId: result.rows[0].secret_id,
    nickname: result.rows[0].nickname,
    playerIndex: result.rows[0].player_index,
    team: result.rows[0].team ?? undefined,
    connected: result.rows[0].connected,
    isAI: result.rows[0].is_ai,
  };
}

export async function getSessionPlayers(sessionId: string): Promise<Player[]> {
  const result = await pool.query(
    `SELECT id, session_id, secret_id, nickname, player_index, team, connected, is_ai
     FROM players WHERE session_id = $1
     ORDER BY player_index`,
    [sessionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    secretId: row.secret_id,
    nickname: row.nickname,
    playerIndex: row.player_index,
    team: row.team ?? undefined,
    connected: row.connected,
    isAI: row.is_ai,
  }));
}

export async function updatePlayerConnection(playerId: string, connected: boolean): Promise<void> {
  await pool.query('UPDATE players SET connected = $1 WHERE id = $2', [connected, playerId]);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  await pool.query('UPDATE sessions SET status = $1 WHERE id = $2', [status, sessionId]);
}

/**
 * Check if a player is the host (player index 0) of a session
 */
export async function isHost(secretId: string, sessionId: string): Promise<boolean> {
  const player = await getPlayerBySecretId(secretId);
  return player !== null && player.sessionId === sessionId && player.playerIndex === 0;
}

/**
 * Add an AI player to a session
 */
export async function addAIPlayer(sessionId: string, aiNamePrefix: string = 'KI'): Promise<Player> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get session info
    const sessionResult = await client.query(
      'SELECT player_count, status FROM sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
    }

    const { player_count: playerCount, status } = sessionResult.rows[0];

    if (status !== 'waiting') {
      throw new GameError(SERVER_ERROR_CODES.CANNOT_ADD_AI_WHEN_GAME_STARTED);
    }

    // Get current players
    const playersResult = await client.query(
      'SELECT player_index, nickname FROM players WHERE session_id = $1',
      [sessionId]
    );

    if (playersResult.rows.length >= playerCount) {
      throw new GameError(SERVER_ERROR_CODES.NO_AVAILABLE_SLOTS);
    }

    // Find next available player index
    const usedIndices = new Set(playersResult.rows.map((r) => r.player_index));
    let playerIndex: PlayerIndex = 0;
    while (usedIndices.has(playerIndex)) {
      playerIndex = (playerIndex + 1) as PlayerIndex;
    }

    // Pick a unique AI name
    const usedNames = new Set(playersResult.rows.map((r) => r.nickname));
    let nickname = '';
    for (const name of AI_NAMES) {
      const fullName = `${aiNamePrefix} ${name}`;
      if (!usedNames.has(fullName)) {
        nickname = fullName;
        break;
      }
    }

    // Fallback if all names are taken (shouldn't happen with 25 names and max 4 players)
    if (!nickname) {
      nickname = `${aiNamePrefix} ${playerIndex + 1}`;
    }

    // Determine team for 4-player games
    const team = playerCount === 4 ? ((playerIndex % 2) as Team) : null;

    // Create AI player (no secret_id needed)
    const playerResult = await client.query(
      `INSERT INTO players (session_id, secret_id, nickname, player_index, team, is_ai, connected)
       VALUES ($1, NULL, $2, $3, $4, true, true)
       RETURNING id, session_id, secret_id, nickname, player_index, team, connected, is_ai`,
      [sessionId, nickname, playerIndex, team]
    );

    await client.query('COMMIT');

    return {
      id: playerResult.rows[0].id,
      sessionId: playerResult.rows[0].session_id,
      secretId: playerResult.rows[0].secret_id,
      nickname: playerResult.rows[0].nickname,
      playerIndex: playerResult.rows[0].player_index,
      team: playerResult.rows[0].team ?? undefined,
      connected: playerResult.rows[0].connected,
      isAI: playerResult.rows[0].is_ai,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove an AI player from a session
 */
export async function removeAIPlayer(sessionId: string, playerIndex: PlayerIndex): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get session info
    const sessionResult = await client.query(
      'SELECT status FROM sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
    }

    const { status } = sessionResult.rows[0];

    if (status !== 'waiting') {
      throw new GameError(SERVER_ERROR_CODES.CANNOT_REMOVE_AI_WHEN_GAME_STARTED);
    }

    // Check if player exists and is AI
    const playerResult = await client.query(
      'SELECT is_ai FROM players WHERE session_id = $1 AND player_index = $2',
      [sessionId, playerIndex]
    );

    if (playerResult.rows.length === 0) {
      throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
    }

    if (!playerResult.rows[0].is_ai) {
      throw new GameError(SERVER_ERROR_CODES.PLAYER_NOT_AI);
    }

    // Delete the AI player
    await client.query('DELETE FROM players WHERE session_id = $1 AND player_index = $2', [
      sessionId,
      playerIndex,
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
