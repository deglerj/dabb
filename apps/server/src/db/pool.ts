import pg from 'pg';
import { env } from '../config/env.js';
import { dbLogger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  dbLogger.error({ err }, 'Unexpected database error');
});

pool.on('connect', () => {
  dbLogger.debug('New database connection established');
});

/**
 * Close all pool connections gracefully
 */
export async function closePool(): Promise<void> {
  dbLogger.info('Closing database connection pool');
  await pool.end();
  dbLogger.info('Database connection pool closed');
}

export { pool };
