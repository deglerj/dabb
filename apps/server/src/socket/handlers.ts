import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GameEvent,
} from '@dabb/shared-types';
import { filterEventsForPlayer } from '@dabb/game-logic';

import {
  startGame,
  placeBid,
  passBid,
  takeDabb,
  discardCards,
  declareTrump,
  declareMelds,
  playCard,
} from '../services/gameService.js';
import { getPlayerBySecretId, updatePlayerConnection } from '../services/sessionService.js';
import { getEvents } from '../services/eventService.js';
import { socketLogger } from '../utils/logger.js';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Map of sessionId -> Set of connected sockets
const sessionSockets = new Map<string, Set<GameSocket>>();

export function setupSocketHandlers(io: GameServer) {
  io.use(async (socket, next) => {
    try {
      const { secretId, sessionId } = socket.handshake.auth;

      if (!secretId || !sessionId) {
        return next(new Error('Missing authentication'));
      }

      const player = await getPlayerBySecretId(secretId);

      if (!player || player.sessionId !== sessionId) {
        return next(new Error('Invalid credentials'));
      }

      socket.data.sessionId = sessionId;
      socket.data.playerId = player.id;
      socket.data.playerIndex = player.playerIndex;

      next();
    } catch (_error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: GameSocket) => {
    const { sessionId, playerId, playerIndex } = socket.data;

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

    // Notify others
    socket.to(sessionId).emit('player:reconnected', { playerIndex });

    // Send current state
    try {
      const events = await getEvents(sessionId);
      const filteredEvents = filterEventsForPlayer(events, playerIndex);
      socket.emit('game:state', { events: filteredEvents });
    } catch {
      // Game not started yet, that's ok
    }

    // Handle game start
    socket.on('game:start', async () => {
      try {
        const events = await startGame(sessionId);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'START_FAILED' });
      }
    });

    // Handle bidding
    socket.on('game:bid', async ({ amount }) => {
      try {
        const events = await placeBid(sessionId, playerIndex, amount);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'BID_FAILED' });
      }
    });

    socket.on('game:pass', async () => {
      try {
        const events = await passBid(sessionId, playerIndex);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'PASS_FAILED' });
      }
    });

    // Handle dabb
    socket.on('game:takeDabb', async () => {
      try {
        const events = await takeDabb(sessionId, playerIndex);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'DABB_FAILED' });
      }
    });

    socket.on('game:discard', async ({ cardIds }) => {
      try {
        const events = await discardCards(sessionId, playerIndex, cardIds);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'DISCARD_FAILED' });
      }
    });

    // Handle trump declaration
    socket.on('game:declareTrump', async ({ suit }) => {
      try {
        const events = await declareTrump(sessionId, playerIndex, suit);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'TRUMP_FAILED' });
      }
    });

    // Handle melds
    socket.on('game:declareMelds', async ({ melds }) => {
      try {
        const events = await declareMelds(sessionId, playerIndex, melds);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'MELDS_FAILED' });
      }
    });

    // Handle card play
    socket.on('game:playCard', async ({ cardId }) => {
      try {
        const events = await playCard(sessionId, playerIndex, cardId);
        broadcastEvents(io, sessionId, events);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'PLAY_FAILED' });
      }
    });

    // Handle sync request
    socket.on('game:sync', async ({ lastEventSequence }) => {
      try {
        const events = await getEvents(sessionId, lastEventSequence);
        const filteredEvents = filterEventsForPlayer(events, playerIndex);
        socket.emit('game:events', { events: filteredEvents });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', { message, code: 'SYNC_FAILED' });
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
