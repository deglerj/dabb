import type { GameEvent } from '@dabb/shared-types';

import { pool } from '../db/pool.js';

export async function saveEvent(event: GameEvent): Promise<void> {
  await pool.query(
    `INSERT INTO events (id, session_id, sequence, event_type, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.id, event.sessionId, event.sequence, event.type, event.payload]
  );
}

export async function saveEvents(events: GameEvent[]): Promise<void> {
  if (events.length === 0) {return;}

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const event of events) {
      await client.query(
        `INSERT INTO events (id, session_id, sequence, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.id, event.sessionId, event.sequence, event.type, event.payload]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getEvents(
  sessionId: string,
  afterSequence: number = 0
): Promise<GameEvent[]> {
  const result = await pool.query(
    `SELECT id, session_id, sequence, event_type, payload, created_at
     FROM events
     WHERE session_id = $1 AND sequence > $2
     ORDER BY sequence ASC`,
    [sessionId, afterSequence]
  );

  return result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    sequence: parseInt(row.sequence),
    type: row.event_type,
    payload: row.payload,
    timestamp: new Date(row.created_at).getTime(),
  })) as GameEvent[];
}

export async function getAllEvents(sessionId: string): Promise<GameEvent[]> {
  return getEvents(sessionId, -1);
}

export async function getLastSequence(sessionId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(MAX(sequence), 0) as max_seq
     FROM events WHERE session_id = $1`,
    [sessionId]
  );

  return parseInt(result.rows[0].max_seq);
}
