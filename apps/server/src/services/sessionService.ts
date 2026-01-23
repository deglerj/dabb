import { v4 as uuidv4 } from 'uuid';
import type { PlayerCount, PlayerIndex, Team } from '@dabb/shared-types';

import { pool } from '../db/pool.js';
import { generateSessionCode } from '../utils/sessionCode.js';

export interface Session {
  id: string;
  code: string;
  playerCount: PlayerCount;
  status: 'waiting' | 'active' | 'finished';
  targetScore: number;
  createdAt: Date;
}

export interface Player {
  id: string;
  sessionId: string;
  secretId: string;
  nickname: string;
  playerIndex: PlayerIndex;
  team?: Team;
  connected: boolean;
}

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
      const existing = await client.query(
        'SELECT id FROM sessions WHERE code = $1',
        [code]
      );
      if (existing.rows.length === 0) {break;}
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique session code');
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
       RETURNING id, session_id, secret_id, nickname, player_index, team, connected`,
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

  if (result.rows.length === 0) {return null;}

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

  if (result.rows.length === 0) {return null;}

  return {
    id: result.rows[0].id,
    code: result.rows[0].code,
    playerCount: result.rows[0].player_count,
    status: result.rows[0].status,
    targetScore: result.rows[0].target_score,
    createdAt: result.rows[0].created_at,
  };
}

export async function joinSession(
  sessionId: string,
  nickname: string
): Promise<Player> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get session info
    const sessionResult = await client.query(
      'SELECT player_count, status FROM sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { player_count: playerCount, status } = sessionResult.rows[0];

    if (status !== 'waiting') {
      throw new Error('Game has already started');
    }

    // Get current players
    const playersResult = await client.query(
      'SELECT player_index FROM players WHERE session_id = $1',
      [sessionId]
    );

    if (playersResult.rows.length >= playerCount) {
      throw new Error('Session is full');
    }

    // Find next available player index
    const usedIndices = new Set(playersResult.rows.map(r => r.player_index));
    let playerIndex: PlayerIndex = 0;
    while (usedIndices.has(playerIndex)) {
      playerIndex = (playerIndex + 1) as PlayerIndex;
    }

    // Determine team for 4-player games
    const team = playerCount === 4 ? (playerIndex % 2) as Team : null;

    // Create player
    const secretId = uuidv4();
    const playerResult = await client.query(
      `INSERT INTO players (session_id, secret_id, nickname, player_index, team)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, session_id, secret_id, nickname, player_index, team, connected`,
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
    `SELECT id, session_id, secret_id, nickname, player_index, team, connected
     FROM players WHERE secret_id = $1`,
    [secretId]
  );

  if (result.rows.length === 0) {return null;}

  return {
    id: result.rows[0].id,
    sessionId: result.rows[0].session_id,
    secretId: result.rows[0].secret_id,
    nickname: result.rows[0].nickname,
    playerIndex: result.rows[0].player_index,
    team: result.rows[0].team ?? undefined,
    connected: result.rows[0].connected,
  };
}

export async function getSessionPlayers(sessionId: string): Promise<Player[]> {
  const result = await pool.query(
    `SELECT id, session_id, secret_id, nickname, player_index, team, connected
     FROM players WHERE session_id = $1
     ORDER BY player_index`,
    [sessionId]
  );

  return result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    secretId: row.secret_id,
    nickname: row.nickname,
    playerIndex: row.player_index,
    team: row.team ?? undefined,
    connected: row.connected,
  }));
}

export async function updatePlayerConnection(
  playerId: string,
  connected: boolean
): Promise<void> {
  await pool.query(
    'UPDATE players SET connected = $1 WHERE id = $2',
    [connected, playerId]
  );
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'waiting' | 'active' | 'finished'
): Promise<void> {
  await pool.query(
    'UPDATE sessions SET status = $1 WHERE id = $2',
    [status, sessionId]
  );
}
