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
import { sessionsRouter } from './routes/sessions.js';
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

app.use('/sessions', limiter);

// Health check (no rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/sessions', sessionsRouter);

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

// Start server
httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT, corsOrigin, env: env.NODE_ENV }, 'Server started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
