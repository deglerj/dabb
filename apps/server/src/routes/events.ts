import { Router } from 'express';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@dabb/shared-types';
import { formatEventLog } from '@dabb/game-logic';

import {
  getSessionByCode,
  getSessionPlayers,
  updateSessionStatus,
} from '../services/sessionService.js';
import { getAllEvents } from '../services/eventService.js';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: GameServer | null = null;

/**
 * Set the Socket.IO server instance for disconnecting players
 */
export function setSocketServer(server: GameServer): void {
  io = server;
}

/**
 * Disconnect all players in a session
 */
async function disconnectSessionPlayers(sessionId: string): Promise<void> {
  if (!io) {
    return;
  }

  // Get all sockets in the session room and disconnect them
  const sockets = await io.in(sessionId).fetchSockets();
  for (const socket of sockets) {
    socket.emit('session:terminated', {
      message: 'Session terminated due to event export',
    });
    socket.disconnect(true);
  }
}

const router = Router();

/**
 * Export game events in human-readable format
 * This terminates the session to prevent cheating (since all cards are revealed)
 */
router.get('/:code/events/export', async (req, res) => {
  try {
    const { code } = req.params;

    // Get session
    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // Check if already terminated
    if (session.status === 'terminated') {
      return res.status(409).json({
        error: 'Session has already been terminated',
        code: 'SESSION_TERMINATED',
      });
    }

    // Get all events (unfiltered - includes all card details)
    const events = await getAllEvents(session.id);

    // Get players for better formatting
    const players = await getSessionPlayers(session.id);
    const playerInfos = players.map((p) => ({
      playerIndex: p.playerIndex,
      nickname: p.nickname,
      team: p.team,
    }));

    // Format the event log
    const log = formatEventLog(events, {
      sessionCode: session.code,
      sessionId: session.id,
      players: playerInfos,
      terminated: true,
    });

    // Terminate the session
    await updateSessionStatus(session.id, 'terminated');

    // Disconnect all players
    await disconnectSessionPlayers(session.id);

    // Return the log as plain text
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dabb-${code}-events.txt"`);
    res.send(log);
  } catch (error) {
    console.error('Error exporting events:', error);
    res.status(500).json({
      error: 'Failed to export events',
      code: 'INTERNAL_ERROR',
    });
  }
});

const eventsRouter: Router = router;
export { eventsRouter };
