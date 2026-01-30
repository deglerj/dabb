/**
 * Environment configuration with validation
 */

import { cleanEnv, str, port, num, bool } from 'envalid';

export const env = cleanEnv(process.env, {
  // Server
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3000 }),

  // Database
  DATABASE_URL: str({
    desc: 'PostgreSQL connection string',
    example: 'postgresql://user:pass@localhost:5432/dabb',
  }),

  // CORS
  CLIENT_URL: str({ default: 'http://localhost:5173' }),

  // Logging
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
  }),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: num({ default: 60000 }), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

  // Session
  SESSION_CLEANUP_INTERVAL_MS: num({ default: 3600000 }), // 1 hour
  SESSION_MAX_AGE_MS: num({ default: 86400000 }), // 24 hours
  SESSION_INACTIVITY_TIMEOUT_MS: num({ default: 172800000 }), // 2 days

  // Development
  TRUST_PROXY: bool({ default: false }),
});

export type Env = typeof env;
