/**
 * Cleanup service - handles finding and terminating inactive sessions
 */

import { pool } from '../db/pool.js';
import type { SessionStatus } from './sessionService.js';

export interface InactiveSession {
  id: string;
  code: string;
  status: SessionStatus;
  lastActivity: Date;
}

/**
 * Find sessions that have been inactive (no events) for longer than the threshold
 * @param thresholdMs - Inactivity threshold in milliseconds
 * @returns Array of inactive sessions
 */
export async function findInactiveSessions(thresholdMs: number): Promise<InactiveSession[]> {
  const cutoffTime = new Date(Date.now() - thresholdMs);

  const result = await pool.query<{
    id: string;
    code: string;
    status: SessionStatus;
    last_activity: Date;
  }>(
    `SELECT s.id, s.code, s.status, COALESCE(MAX(e.created_at), s.updated_at) as last_activity
     FROM sessions s
     LEFT JOIN events e ON e.session_id = s.id
     WHERE s.status IN ('waiting', 'active')
     GROUP BY s.id
     HAVING COALESCE(MAX(e.created_at), s.updated_at) < $1`,
    [cutoffTime]
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    lastActivity: row.last_activity,
  }));
}

/**
 * Terminate a session by updating its status to 'terminated'
 * @param sessionId - The session ID to terminate
 */
export async function terminateSession(sessionId: string): Promise<void> {
  await pool.query("UPDATE sessions SET status = 'terminated' WHERE id = $1", [sessionId]);
}
