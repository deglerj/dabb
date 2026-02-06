import { Router } from 'express';
import type {
  AddAIPlayerResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  PlayerIndex,
  ReconnectRequest,
  ReconnectResponse,
  SessionInfoResponse,
} from '@dabb/shared-types';
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

import {
  addAIPlayer,
  createSession,
  getSessionByCode,
  isHost,
  joinSession,
  getPlayerBySecretId,
  getSessionPlayers,
  removeAIPlayer,
} from '../services/sessionService.js';
import { registerAIPlayer, unregisterAIPlayer } from '../services/aiControllerService.js';
import { getLastSequence } from '../services/eventService.js';

const router = Router();

// Create a new session
router.post('/', async (req, res) => {
  try {
    const { playerCount, targetScore = 1000, nickname } = req.body as CreateSessionRequest;

    if (!playerCount || ![2, 3, 4].includes(playerCount)) {
      return res.status(400).json({
        error: 'Invalid player count',
        code: 'INVALID_PLAYER_COUNT',
      });
    }

    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({
        error: 'Nickname is required',
        code: 'NICKNAME_REQUIRED',
      });
    }

    const { session, player } = await createSession(playerCount, targetScore, nickname.trim());

    const response: CreateSessionResponse = {
      sessionCode: session.code,
      sessionId: session.id,
      playerId: player.id,
      secretId: player.secretId!, // Host always has secretId
      playerIndex: player.playerIndex,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get session info
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const players = await getSessionPlayers(session.id);

    const response: SessionInfoResponse = {
      sessionId: session.id,
      sessionCode: session.code,
      playerCount: session.playerCount,
      status: session.status,
      targetScore: session.targetScore,
      players: players.map((p) => ({
        nickname: p.nickname,
        playerIndex: p.playerIndex,
        team: p.team,
        connected: p.connected,
        isAI: p.isAI,
      })),
      createdAt: session.createdAt.toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Join a session
router.post('/:code/join', async (req, res) => {
  try {
    const { code } = req.params;
    const { nickname } = req.body as JoinSessionRequest;

    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({
        error: 'Nickname is required',
        code: 'NICKNAME_REQUIRED',
      });
    }

    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const player = await joinSession(session.id, nickname.trim());

    const response: JoinSessionResponse = {
      sessionId: session.id,
      playerId: player.id,
      secretId: player.secretId!, // Human players always have secretId
      playerIndex: player.playerIndex,
      team: player.team,
    };

    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Game has already started') {
      return res.status(409).json({
        error: message,
        code: 'GAME_STARTED',
      });
    }

    if (message === 'Session is full') {
      return res.status(409).json({
        error: message,
        code: 'SESSION_FULL',
      });
    }

    console.error('Error joining session:', error);
    res.status(500).json({
      error: 'Failed to join session',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Reconnect to a session
router.post('/:code/reconnect', async (req, res) => {
  try {
    const { code } = req.params;
    const { secretId } = req.body as ReconnectRequest;

    if (!secretId) {
      return res.status(400).json({
        error: 'Secret ID is required',
        code: 'SECRET_ID_REQUIRED',
      });
    }

    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const player = await getPlayerBySecretId(secretId);

    if (!player || player.sessionId !== session.id) {
      return res.status(401).json({
        error: 'Invalid secret ID',
        code: 'INVALID_SECRET',
      });
    }

    const lastSequence = await getLastSequence(session.id);

    const response: ReconnectResponse = {
      playerId: player.id,
      playerIndex: player.playerIndex,
      lastEventSequence: lastSequence,
    };

    res.json(response);
  } catch (error) {
    console.error('Error reconnecting:', error);
    res.status(500).json({
      error: 'Failed to reconnect',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Add AI player to a session
router.post('/:code/ai', async (req, res) => {
  try {
    const { code } = req.params;
    const secretId = req.headers['x-secret-id'] as string;

    if (!secretId) {
      return res.status(401).json({
        error: 'Secret ID is required',
        code: 'SECRET_ID_REQUIRED',
      });
    }

    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: SERVER_ERROR_CODES.SESSION_NOT_FOUND,
      });
    }

    // Verify requester is host
    const hostCheck = await isHost(secretId, session.id);
    if (!hostCheck) {
      return res.status(403).json({
        error: 'Only the host can add AI players',
        code: SERVER_ERROR_CODES.NOT_HOST,
      });
    }

    // Get language preference from header (default to German)
    const language = req.headers['accept-language']?.startsWith('en') ? 'AI' : 'KI';

    const player = await addAIPlayer(session.id, language);

    // Register AI in the controller
    registerAIPlayer(session.id, player.playerIndex);

    const response: AddAIPlayerResponse = {
      playerId: player.id,
      playerIndex: player.playerIndex,
      nickname: player.nickname,
      team: player.team,
    };

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof GameError) {
      const status =
        error.code === SERVER_ERROR_CODES.SESSION_NOT_FOUND
          ? 404
          : error.code === SERVER_ERROR_CODES.NOT_HOST
            ? 403
            : 409;
      return res.status(status).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error('Error adding AI player:', error);
    res.status(500).json({
      error: 'Failed to add AI player',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Remove AI player from a session
router.delete('/:code/ai/:playerIndex', async (req, res) => {
  try {
    const { code, playerIndex: playerIndexStr } = req.params;
    const secretId = req.headers['x-secret-id'] as string;
    const playerIndex = parseInt(playerIndexStr, 10) as PlayerIndex;

    if (!secretId) {
      return res.status(401).json({
        error: 'Secret ID is required',
        code: 'SECRET_ID_REQUIRED',
      });
    }

    if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 3) {
      return res.status(400).json({
        error: 'Invalid player index',
        code: 'INVALID_PLAYER_INDEX',
      });
    }

    const session = await getSessionByCode(code);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: SERVER_ERROR_CODES.SESSION_NOT_FOUND,
      });
    }

    // Verify requester is host
    const hostCheck = await isHost(secretId, session.id);
    if (!hostCheck) {
      return res.status(403).json({
        error: 'Only the host can remove AI players',
        code: SERVER_ERROR_CODES.NOT_HOST,
      });
    }

    await removeAIPlayer(session.id, playerIndex);

    // Unregister AI from the controller
    unregisterAIPlayer(session.id, playerIndex);

    res.status(204).send();
  } catch (error) {
    if (error instanceof GameError) {
      const status =
        error.code === SERVER_ERROR_CODES.SESSION_NOT_FOUND
          ? 404
          : error.code === SERVER_ERROR_CODES.NOT_HOST
            ? 403
            : 409;
      return res.status(status).json({
        error: error.message,
        code: error.code,
      });
    }

    console.error('Error removing AI player:', error);
    res.status(500).json({
      error: 'Failed to remove AI player',
      code: 'INTERNAL_ERROR',
    });
  }
});

const sessionsRouter: Router = router;
export { sessionsRouter };
