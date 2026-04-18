import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { runner } from 'node-pg-migrate';

import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsDir = join(__dirname, 'migrations');

  try {
    await runner({
      databaseUrl: env.DATABASE_URL,
      dir: migrationsDir,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      verbose: false,
    });
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error({ error }, 'Database migration failed');
    throw error;
  }
}
