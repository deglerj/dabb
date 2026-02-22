import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GameEvent,
} from '@dabb/shared-types';
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';
import { filterEventsForPlayer } from '@dabb/game-logic';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import {
  startGame,
  placeBid,
  passBid,
  takeDabb,
  discardCards,
  goOut,
  declareTrump,
  declareMelds,
  playCard,
  terminateGame,
} from '../services/gameService.js';
import {
  getPlayerBySecretId,
  getSessionByCode,
  updatePlayerConnection,
} from '../services/sessionService.js';
import { getEvents } from '../services/eventService.js';
import { socketLogger } from '../utils/logger.js';
import {
  checkAndTriggerAI,
  cleanupSession as cleanupAISession,
  initializeAIPlayersFromSession,
} from '../services/aiControllerService.js';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Emit a structured error to the socket
 */
function emitError(socket: GameSocket, error: unknown): void {
  if (error instanceof GameError) {
    socket.emit('error', {
      message: error.code,
      code: error.code,
      params: error.params,
    });
  } else {
    socket.emit('error', {
      message: SERVER_ERROR_CODES.UNKNOWN_ERROR,
      code: SERVER_ERROR_CODES.UNKNOWN_ERROR,
    });
  }
}

// Rate limiter: 30 events per 10 seconds per socket (generous for gameplay)
const rateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 10,
});

// Returns true if rate limit exceeded
async function isRateLimited(socket: GameSocket): Promise<boolean> {
  try {
    await rateLimiter.consume(socket.id);
    return false;
  } catch {
    socketLogger.warn({ socketId: socket.id }, 'Socket rate limit exceeded');
    socket.emit('error', { message: 'Too many requests', code: 'RATE_LIMITED' });
    return true;
  }
}

// Map of sessionId -> Set of connected sockets
// Exported for cleanup scheduler to disconnect sockets on terminated sessions
export const sessionSockets = new Map<string, Set<GameSocket>>();

export function setupSocketHandlers(io: GameServer) {
  io.use(async (socket, next) => {
    try {
      // Note: sessionId from auth is actually the session code (from URL)
      const { secretId, sessionId: sessionCode } = socket.handshake.auth;

      if (!secretId || !sessionCode) {
        return next(new Error('Missing authentication'));
      }

      const player = await getPlayerBySecretId(secretId);
      if (!player) {
        return next(new Error('Invalid credentials'));
      }

      // Validate that the session code matches the player's session
      const session = await getSessionByCode(sessionCode);
      if (!session || player.sessionId !== session.id) {
        return next(new Error('Invalid credentials'));
      }

      // Use the session UUID for database queries and room management
      socket.data.sessionId = session.id;
      socket.data.playerId = player.id;
      socket.data.playerIndex = player.playerIndex;
      socket.data.nickname = player.nickname;
      socket.data.wasConnected = player.connected;

      next();
    } catch (_error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: GameSocket) => {
    const { sessionId, playerId, playerIndex, nickname, wasConnected } = socket.data;

    socketLogger.info({ sessionId, playerIndex }, 'Player connected');

    // Join session room
    socket.join(sessionId);

    // Track socket
    if (!sessionSockets.has(sessionId)) {
      sessionSockets.set(sessionId, new Set());
    }
    sessionSockets.get(sessionId)!.add(socket);

    // Mark player as connected
    await updatePlayerConnection(playerId, true);

    // Notify others - emit player:joined for new players, player:reconnected for returning players
    if (wasConnected) {
      socket.to(sessionId).emit('player:reconnected', { playerIndex });
    } else {
      socket.to(sessionId).emit('player:joined', { playerIndex, nickname, isAI: false });
    }

    // Send current state
    try {
      const events = await getEvents(sessionId);
      const filteredEvents = filterEventsForPlayer(events, playerIndex);
      socket.emit('game:state', { events: filteredEvents });
      // Re-initialize AI players in case the server restarted (instances are in-memory only)
      await initializeAIPlayersFromSession(sessionId);
      await checkAndTriggerAI(sessionId, io);
    } catch {
      // Game not started yet, that's ok
    }

    // Handle game start
    socket.on('game:start', async () => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        // Initialize AI players from session data
        await initializeAIPlayersFromSession(sessionId);

        const events = await startGame(sessionId);
        broadcastEvents(io, sessionId, events);

        // Check if first player is AI
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle bidding
    socket.on('game:bid', async ({ amount }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await placeBid(sessionId, playerIndex, amount);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('game:pass', async () => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await passBid(sessionId, playerIndex);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle dabb
    socket.on('game:takeDabb', async () => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await takeDabb(sessionId, playerIndex);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('game:discard', async ({ cardIds }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await discardCards(sessionId, playerIndex, cardIds);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle going out
    socket.on('game:goOut', async ({ suit }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await goOut(sessionId, playerIndex, suit);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle trump declaration
    socket.on('game:declareTrump', async ({ suit }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await declareTrump(sessionId, playerIndex, suit);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle melds
    socket.on('game:declareMelds', async ({ melds }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await declareMelds(sessionId, playerIndex, melds);
        broadcastEvents(io, sessionId, events);
        await checkAndTriggerAI(sessionId, io);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle card play
    socket.on('game:playCard', async ({ cardId }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await playCard(sessionId, playerIndex, cardId);
        broadcastEvents(io, sessionId, events);
        // If a trick was won, delay AI to allow clients to display the completed trick
        const trickWasWon = events.some((e) => e.type === 'TRICK_WON');
        await checkAndTriggerAI(sessionId, io, trickWasWon);
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle sync request
    socket.on('game:sync', async ({ lastEventSequence }) => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const events = await getEvents(sessionId, lastEventSequence);
        const filteredEvents = filterEventsForPlayer(events, playerIndex);
        socket.emit('game:events', { events: filteredEvents });
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle game exit
    socket.on('game:exit', async () => {
      if (await isRateLimited(socket)) {
        return;
      }
      try {
        const event = await terminateGame(sessionId, playerIndex);
        broadcastEvents(io, sessionId, [event]);

        // Clean up AI players
        cleanupAISession(sessionId);

        // Notify all players that the session was terminated
        io.to(sessionId).emit('session:terminated', {
          message: 'Game terminated by player',
          terminatedBy: nickname,
        });

        // Disconnect all sockets in the session
        const sockets = sessionSockets.get(sessionId);
        if (sockets) {
          for (const s of sockets) {
            s.disconnect(true);
          }
          sessionSockets.delete(sessionId);
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      socketLogger.info({ sessionId, playerIndex }, 'Player disconnected');

      // Remove from tracking
      sessionSockets.get(sessionId)?.delete(socket);

      // Mark player as disconnected
      await updatePlayerConnection(playerId, false);

      // Notify others
      socket.to(sessionId).emit('player:left', { playerIndex });
    });
  });
}

async function broadcastEvents(_io: GameServer, sessionId: string, events: GameEvent[]) {
  const sockets = sessionSockets.get(sessionId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    const filteredEvents = filterEventsForPlayer(events, socket.data.playerIndex);
    socket.emit('game:events', { events: filteredEvents });
  }
}
