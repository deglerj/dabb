/**
 * REST API types
 */

import type { PlayerCount, PlayerIndex, Team } from './game.js';

// Session creation
export interface CreateSessionRequest {
  playerCount: PlayerCount;
  targetScore?: number;
  nickname: string;
}

export interface CreateSessionResponse {
  sessionCode: string;
  sessionId: string;
  playerId: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

// Join session
export interface JoinSessionRequest {
  nickname: string;
}

export interface JoinSessionResponse {
  sessionId: string;
  playerId: string;
  secretId: string;
  playerIndex: PlayerIndex;
  team?: Team;
}

// Reconnect
export interface ReconnectRequest {
  secretId: string;
}

export interface ReconnectResponse {
  playerId: string;
  playerIndex: PlayerIndex;
  lastEventSequence: number;
}

// Session status
export type SessionStatus = 'waiting' | 'active' | 'finished' | 'terminated';

// Session info
export interface SessionInfoResponse {
  sessionId: string;
  sessionCode: string;
  playerCount: PlayerCount;
  status: SessionStatus;
  targetScore: number;
  players: Array<{
    nickname: string;
    playerIndex: PlayerIndex;
    team?: Team;
    connected: boolean;
    isAI: boolean;
  }>;
  createdAt: string;
}

// Add AI player
export interface AddAIPlayerResponse {
  playerId: string;
  playerIndex: PlayerIndex;
  nickname: string;
  team?: Team;
}

// Error response
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
