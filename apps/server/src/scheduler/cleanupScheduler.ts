/**
 * Cleanup scheduler - periodically terminates inactive sessions
 */

import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@dabb/shared-types';

import { env } from '../config/env.js';
import { findInactiveSessions, terminateSession } from '../services/cleanupService.js';
import { clearGameStateCache } from '../services/gameService.js';
import { sessionSockets } from '../socket/handlers.js';
import logger from '../utils/logger.js';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const cleanupLogger = logger.child({ component: 'cleanup' });

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Run the cleanup process - find and terminate inactive sessions
 */
export async function runCleanup(): Promise<number> {
  const thresholdMs = env.SESSION_INACTIVITY_TIMEOUT_MS;

  cleanupLogger.debug({ thresholdMs }, 'Running inactive session cleanup');

  try {
    const inactiveSessions = await findInactiveSessions(thresholdMs);

    if (inactiveSessions.length === 0) {
      cleanupLogger.debug('No inactive sessions found');
      return 0;
    }

    cleanupLogger.info({ count: inactiveSessions.length }, 'Found inactive sessions to terminate');

    for (const session of inactiveSessions) {
      await terminateInactiveSession(session.id, session.code);
    }

    return inactiveSessions.length;
  } catch (error) {
    cleanupLogger.error({ error }, 'Error during cleanup');
    return 0;
  }
}

/**
 * Terminate a single inactive session
 */
async function terminateInactiveSession(sessionId: string, sessionCode: string): Promise<void> {
  cleanupLogger.info({ sessionId, sessionCode }, 'Terminating inactive session');

  // Update database status
  await terminateSession(sessionId);

  // Notify and disconnect any connected sockets
  const sockets = sessionSockets.get(sessionId);
  if (sockets && sockets.size > 0) {
    cleanupLogger.info(
      { sessionId, socketCount: sockets.size },
      'Disconnecting sockets for terminated session'
    );

    for (const socket of sockets) {
      socket.emit('session:terminated', {
        message: 'Session terminated due to inactivity',
      });
      socket.disconnect(true);
    }

    // Clear the socket set
    sessionSockets.delete(sessionId);
  }

  // Clear cached game state
  clearGameStateCache(sessionId);
}

/**
 * Start the cleanup scheduler
 * Runs cleanup immediately on startup and then at regular intervals
 */
export function startCleanupScheduler(_io: GameServer): void {
  const intervalMs = env.SESSION_CLEANUP_INTERVAL_MS;

  cleanupLogger.info(
    {
      intervalMs,
      inactivityTimeoutMs: env.SESSION_INACTIVITY_TIMEOUT_MS,
    },
    'Starting cleanup scheduler'
  );

  // Run immediately on startup
  runCleanup().catch((error) => {
    cleanupLogger.error({ error }, 'Initial cleanup failed');
  });

  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    runCleanup().catch((error) => {
      cleanupLogger.error({ error }, 'Scheduled cleanup failed');
    });
  }, intervalMs);
}

/**
 * Stop the cleanup scheduler
 */
export function stopCleanupScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    cleanupLogger.info('Cleanup scheduler stopped');
  }
}
