import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { migrate } from 'postgres-migrations';

import { pool } from './pool.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsDir = join(__dirname, 'migrations');

  try {
    await migrate({ client: pool }, migrationsDir);
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error({ error }, 'Database migration failed');
    throw error;
  }
}
