import { Router } from 'express';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  ReconnectRequest,
  ReconnectResponse,
  SessionInfoResponse,
} from '@dabb/shared-types';

import {
  createSession,
  getSessionByCode,
  joinSession,
  getPlayerBySecretId,
  getSessionPlayers,
} from '../services/sessionService.js';
import { getLastSequence } from '../services/eventService.js';

const router = Router();

// Create a new session
router.post('/', async (req, res) => {
  try {
    const { playerCount, targetScore = 1500, nickname } = req.body as CreateSessionRequest;

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
      secretId: player.secretId,
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
      secretId: player.secretId,
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

const sessionsRouter: Router = router;
export { sessionsRouter };
