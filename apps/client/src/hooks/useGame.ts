/**
 * useGame — connects to the game server and manages game state.
 */
import { useCallback, useState } from 'react';
import { useSocket, useGameState } from '@dabb/ui-shared';
import { SERVER_URL } from '../constants.js';
import type { CardId, Suit, PlayerIndex, Meld } from '@dabb/shared-types';

export interface UseGameOptions {
  sessionId: string;
  secretId: string;
  playerIndex: number;
}

export function useGame({ sessionId, secretId, playerIndex }: UseGameOptions) {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());

  const { state, events, isInitialLoad, processEvents, reset } = useGameState({
    playerIndex: playerIndex as PlayerIndex,
  });

  const handleStateNicknames = useCallback((record: Record<number, string>) => {
    setNicknames(new Map(Object.entries(record).map(([k, v]) => [Number(k) as PlayerIndex, v])));
  }, []);

  const handlePlayerJoined = useCallback((idx: number, nickname: string) => {
    setNicknames((prev) => {
      const next = new Map(prev);
      next.set(idx as PlayerIndex, nickname);
      return next;
    });
  }, []);

  const { socket, connected, connecting, error } = useSocket({
    serverUrl: SERVER_URL,
    sessionId,
    secretId,
    onEvents: processEvents,
    onStateNicknames: handleStateNicknames,
    onPlayerJoined: handlePlayerJoined,
  });

  const onBid = useCallback((amount: number) => socket?.emit('game:bid', { amount }), [socket]);
  const onPass = useCallback(() => socket?.emit('game:pass'), [socket]);
  const onTakeDabb = useCallback(() => socket?.emit('game:takeDabb'), [socket]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => socket?.emit('game:discard', { cardIds }),
    [socket]
  );
  const onGoOut = useCallback((suit: Suit) => socket?.emit('game:goOut', { suit }), [socket]);
  const onDeclareTrump = useCallback(
    (suit: Suit) => socket?.emit('game:declareTrump', { suit }),
    [socket]
  );
  const onDeclareMelds = useCallback(
    (melds: Meld[]) => socket?.emit('game:declareMelds', { melds }),
    [socket]
  );
  const onPlayCard = useCallback(
    (cardId: CardId) => socket?.emit('game:playCard', { cardId }),
    [socket]
  );

  return {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    connecting,
    error,
    reset,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
  };
}
