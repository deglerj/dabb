import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameEvent,
  GameState,
  CardId,
  Suit,
  Meld,
} from '@dabb/shared-types';
import { applyEvents, createInitialState, getValidPlays } from '@dabb/game-logic';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseGameReturn {
  state: GameState;
  playerIndex: number;
  isMyTurn: boolean;
  validMoves: CardId[];
  error: string | null;
  connected: boolean;
  bid: (amount: number) => void;
  pass: () => void;
  takeDabb: () => void;
  discard: (cardIds: CardId[]) => void;
  declareTrump: (suit: Suit) => void;
  declareMelds: (melds: Meld[]) => void;
  playCard: (cardId: CardId) => void;
}

export function useGame(code: string): UseGameReturn {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [state, setState] = useState<GameState>(createInitialState(4));
  const [, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(`dabb-${code}`);
    if (!stored) return;

    const { secretId, playerIndex: storedIndex, sessionId } = JSON.parse(stored);
    setPlayerIndex(storedIndex);

    const newSocket: GameSocket = io(API_URL, {
      auth: { secretId, sessionId: sessionId || code },
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('game:state', ({ events: newEvents }) => {
      setEvents(newEvents);
      const newState = applyEvents(newEvents);
      setState(newState);
    });

    newSocket.on('game:events', ({ events: newEvents }) => {
      setEvents(prev => {
        const combined = [...prev, ...newEvents];
        const newState = applyEvents(combined);
        setState(newState);
        return combined;
      });
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [code]);

  const isMyTurn = state.currentPlayer === playerIndex || state.currentBidder === playerIndex;

  const validMoves = (() => {
    if (state.phase !== 'tricks' || state.currentPlayer !== playerIndex) {
      return [];
    }
    const hand = state.hands.get(playerIndex) || [];
    if (!state.trump) return hand.map(c => c.id);
    const validCards = getValidPlays(hand, state.currentTrick, state.trump);
    return validCards.map(c => c.id);
  })();

  const bid = useCallback((amount: number) => {
    socket?.emit('game:bid', { amount });
  }, [socket]);

  const pass = useCallback(() => {
    socket?.emit('game:pass');
  }, [socket]);

  const takeDabbFn = useCallback(() => {
    socket?.emit('game:takeDabb');
  }, [socket]);

  const discard = useCallback((cardIds: CardId[]) => {
    socket?.emit('game:discard', { cardIds });
  }, [socket]);

  const declareTrump = useCallback((suit: Suit) => {
    socket?.emit('game:declareTrump', { suit });
  }, [socket]);

  const declareMelds = useCallback((melds: Meld[]) => {
    socket?.emit('game:declareMelds', { melds });
  }, [socket]);

  const playCard = useCallback((cardId: CardId) => {
    socket?.emit('game:playCard', { cardId });
  }, [socket]);

  return {
    state,
    playerIndex,
    isMyTurn,
    validMoves,
    error,
    connected,
    bid,
    pass,
    takeDabb: takeDabbFn,
    discard,
    declareTrump,
    declareMelds,
    playCard,
  };
}
