/**
 * Socket.IO connection hook
 */

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameEvent,
} from '@dabb/shared-types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  serverUrl: string;
  sessionId: string;
  secretId: string;
  onEvents?: (events: GameEvent[]) => void;
  onError?: (error: { message: string; code: string }) => void;
  onPlayerJoined?: (playerIndex: number, nickname: string) => void;
  onPlayerLeft?: (playerIndex: number) => void;
  onPlayerReconnected?: (playerIndex: number) => void;
}

interface UseSocketReturn {
  socket: GameSocket | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  emit: GameSocket['emit'] | null;
}

export function useSocket(options: UseSocketOptions): UseSocketReturn {
  const {
    serverUrl,
    sessionId,
    secretId,
    onEvents,
    onError,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerReconnected,
  } = options;

  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const callbacksRef = useRef({
    onEvents,
    onError,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerReconnected,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onEvents,
      onError,
      onPlayerJoined,
      onPlayerLeft,
      onPlayerReconnected,
    };
  }, [onEvents, onError, onPlayerJoined, onPlayerLeft, onPlayerReconnected]);

  useEffect(() => {
    if (!serverUrl || !sessionId || !secretId) {
      setConnecting(false);
      return;
    }

    const newSocket: GameSocket = io(serverUrl, {
      auth: { secretId, sessionId },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      setError(err.message);
      setConnecting(false);
    });

    newSocket.on('game:events', ({ events }) => {
      callbacksRef.current.onEvents?.(events);
    });

    newSocket.on('game:state', ({ events }) => {
      callbacksRef.current.onEvents?.(events);
    });

    newSocket.on('error', (err) => {
      setError(err.message);
      callbacksRef.current.onError?.(err);
    });

    newSocket.on('player:joined', ({ playerIndex, nickname }) => {
      callbacksRef.current.onPlayerJoined?.(playerIndex, nickname);
    });

    newSocket.on('player:left', ({ playerIndex }) => {
      callbacksRef.current.onPlayerLeft?.(playerIndex);
    });

    newSocket.on('player:reconnected', ({ playerIndex }) => {
      callbacksRef.current.onPlayerReconnected?.(playerIndex);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [serverUrl, sessionId, secretId]);

  return {
    socket,
    connected,
    connecting,
    error,
    emit: socket?.emit.bind(socket) || null,
  };
}
