/**
 * REST API helpers for session management.
 */
import { SERVER_URL } from '../constants.js';
import type { PlayerCount, CreateSessionResponse, JoinSessionResponse } from '@dabb/shared-types';

export type { CreateSessionResponse, JoinSessionResponse };

export async function createSession(
  nickname: string,
  playerCount: PlayerCount
): Promise<CreateSessionResponse> {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname.trim(), playerCount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to create session');
  }
  return res.json() as Promise<CreateSessionResponse>;
}

export async function joinSession(
  joinCode: string,
  nickname: string
): Promise<JoinSessionResponse> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${joinCode.trim().toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname.trim() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to join session');
  }
  return res.json() as Promise<JoinSessionResponse>;
}
