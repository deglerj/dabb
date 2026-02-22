import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@dabb/shared-types';

import { env } from './config/env.js';
import { closePool } from './db/pool.js';
import { runMigrations } from './db/runMigrations.js';
import { sessionsRouter } from './routes/sessions.js';
import { eventsRouter, setSocketServer } from './routes/events.js';
import { versionRouter } from './routes/version.js';
import { startCleanupScheduler, stopCleanupScheduler } from './scheduler/cleanupScheduler.js';
import { setupSocketHandlers } from './socket/handlers.js';
import logger, { apiLogger } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

// Trust proxy if configured (for rate limiting behind reverse proxy)
if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// CORS configuration
const corsOrigin = env.CLIENT_URL;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    apiLogger.warn('Rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

app.use('/api', limiter);

// Health check (no rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/version', versionRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions', eventsRouter);

// Socket.IO setup
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  }
);

setupSocketHandlers(io);
setSocketServer(io);

// Start cleanup scheduler for inactive sessions
startCleanupScheduler(io);

// Start server first (so health checks pass), then run migrations
httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT, corsOrigin, env: env.NODE_ENV }, 'Server started');

  // Run migrations after server is listening
  runMigrations().catch((error) => {
    logger.error({ error }, 'Failed to run migrations, exiting');
    process.exit(1);
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, shutting down gracefully');

  // Close HTTP server first (stop accepting new connections)
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Stop cleanup scheduler
      stopCleanupScheduler();

      // Close Socket.IO connections
      io.close();
      logger.info('Socket.IO server closed');

      // Close database pool
      await closePool();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
