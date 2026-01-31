import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameEvent,
  GameState,
  CardId,
  Suit,
  Meld,
  PlayerIndex,
} from '@dabb/shared-types';
import { applyEvents, createInitialState, getValidPlays } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';
import { updateDebugStore, setTerminateCallback } from '../utils/debug';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TerminationInfo {
  terminatedBy: string | null;
}

interface UseGameReturn {
  state: GameState;
  events: GameEvent[];
  playerIndex: number;
  isMyTurn: boolean;
  validMoves: CardId[];
  error: string | null;
  connected: boolean;
  isTerminated: boolean;
  terminationInfo: TerminationInfo | null;
  bid: (amount: number) => void;
  pass: () => void;
  takeDabb: () => void;
  discard: (cardIds: CardId[]) => void;
  goOut: (suit: Suit) => void;
  declareTrump: (suit: Suit) => void;
  declareMelds: (melds: Meld[]) => void;
  playCard: (cardId: CardId) => void;
  exitGame: () => void;
}

export function useGame(code: string): UseGameReturn {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t; // Keep ref updated with latest t function

  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [state, setState] = useState<GameState>(createInitialState(4));
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationInfo, setTerminationInfo] = useState<TerminationInfo | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`dabb-${code}`);
    if (!stored) {
      return;
    }

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
      // State will be computed by the useEffect when events change
    });

    newSocket.on('game:events', ({ events: newEvents }) => {
      setEvents((prev) => [...prev, ...newEvents]);
    });

    newSocket.on('error', ({ code: errorCode, params }) => {
      // Translate error code to localized message
      const translatedError = tRef.current(`serverErrors.${errorCode}` as const, params);
      setError(translatedError);
    });

    newSocket.on('session:terminated', ({ terminatedBy }) => {
      setIsTerminated(true);
      setTerminationInfo({ terminatedBy: terminatedBy || null });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [code]);

  // Recompute state when events change (for game:events updates)
  useEffect(() => {
    if (events.length > 0) {
      const newState = applyEvents(events);
      setState(newState);
      updateDebugStore(events, newState, code, playerIndex as PlayerIndex);
    }
  }, [events, code, playerIndex]);

  // Set up anti-cheat termination callback for debug commands
  useEffect(() => {
    if (socket && connected) {
      setTerminateCallback(() => {
        socket.emit('game:exit');
      });
    }
    return () => {
      setTerminateCallback(null);
    };
  }, [socket, connected]);

  const isMyTurn = state.currentPlayer === playerIndex || state.currentBidder === playerIndex;

  const validMoves = useMemo(() => {
    if (state.phase !== 'tricks' || state.currentPlayer !== playerIndex) {
      return [];
    }
    const hand = state.hands.get(playerIndex) || [];
    if (!state.trump) {
      return hand.map((c) => c.id);
    }
    const validCards = getValidPlays(hand, state.currentTrick, state.trump);
    return validCards.map((c) => c.id);
  }, [state.phase, state.currentPlayer, playerIndex, state.hands, state.trump, state.currentTrick]);

  const bid = useCallback(
    (amount: number) => {
      socket?.emit('game:bid', { amount });
    },
    [socket]
  );

  const pass = useCallback(() => {
    socket?.emit('game:pass');
  }, [socket]);

  const takeDabbFn = useCallback(() => {
    socket?.emit('game:takeDabb');
  }, [socket]);

  const discard = useCallback(
    (cardIds: CardId[]) => {
      socket?.emit('game:discard', { cardIds });
    },
    [socket]
  );

  const goOut = useCallback(
    (suit: Suit) => {
      socket?.emit('game:goOut', { suit });
    },
    [socket]
  );

  const declareTrump = useCallback(
    (suit: Suit) => {
      socket?.emit('game:declareTrump', { suit });
    },
    [socket]
  );

  const declareMelds = useCallback(
    (melds: Meld[]) => {
      socket?.emit('game:declareMelds', { melds });
    },
    [socket]
  );

  const playCard = useCallback(
    (cardId: CardId) => {
      socket?.emit('game:playCard', { cardId });
    },
    [socket]
  );

  const exitGame = useCallback(() => {
    socket?.emit('game:exit');
  }, [socket]);

  return {
    state,
    events,
    playerIndex,
    isMyTurn,
    validMoves,
    error,
    connected,
    isTerminated,
    terminationInfo,
    bid,
    pass,
    takeDabb: takeDabbFn,
    discard,
    goOut,
    declareTrump,
    declareMelds,
    playCard,
    exitGame,
  };
}
