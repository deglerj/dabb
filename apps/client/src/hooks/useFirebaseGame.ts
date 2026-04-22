import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameState } from '@dabb/ui-shared';
import type { GameInterface } from '@dabb/ui-shared';
import { applyEvents } from '@dabb/game-logic';
import type { CardId, GameEvent, GameState, Meld, PlayerIndex, Suit } from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';
import { subscribeToEvents, pushEvents, getAllEvents } from '../firebase/events.js';
import { hashSecretId } from '../firebase/secretId.js';
import { getSessionMeta, setupPresence, subscribeToSessionStatus } from '../firebase/session.js';
import type { PlayerInfo } from '../firebase/gameEventFactory.js';
import {
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createGoOutEvents,
  createPlayCardEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
  createTerminateGameEvents,
} from '../firebase/gameEventFactory.js';

export interface UseFirebaseGameOptions {
  sessionCode: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

export interface FirebaseGameResult extends GameInterface {
  rawEvents: GameEvent[];
  players: PlayerInfo[];
  aiPlayerIndices: PlayerIndex[];
}

export function useFirebaseGame({
  sessionCode,
  secretId,
  playerIndex,
}: UseFirebaseGameOptions): FirebaseGameResult {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());
  const [terminatedByNickname, setTerminatedByNickname] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [secretHash, setSecretHash] = useState<string>('');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  const rawEventsRef = useRef<GameEvent[]>([]);
  const fullStateRef = useRef<GameState>(applyEvents([]));

  const { state, events, isInitialLoad, processEvents } = useGameState({ playerIndex });

  useEffect(() => {
    void hashSecretId(secretId).then(setSecretHash);
  }, [secretId]);

  useEffect(() => {
    if (!sessionCode) {
      return;
    }
    void getSessionMeta(sessionCode).then((meta) => {
      if (!meta) {
        return;
      }
      const infos: PlayerInfo[] = Object.entries(meta.players).map(([idx, p]) => ({
        playerIndex: Number(idx) as PlayerIndex,
        nickname: p.nickname,
        isAI: p.isAI,
        team: null,
      }));
      setPlayers(infos);
      const nickMap = new Map<PlayerIndex, string>();
      infos.forEach((p) => nickMap.set(p.playerIndex, p.nickname));
      setNicknames(nickMap);
    });
  }, [sessionCode]);

  useEffect(() => {
    if (!sessionCode) {
      return;
    }
    const unsub = subscribeToSessionStatus(sessionCode, (status) => {
      if (status === 'terminated') {
        setTerminatedByNickname('');
      }
    });
    return unsub;
  }, [sessionCode]);

  useEffect(() => {
    if (!sessionCode || !secretId) {
      return;
    }

    const cleanup = setupPresence(sessionCode, playerIndex);
    setConnected(true);

    void getAllEvents(sessionCode).then((existingEvents) => {
      rawEventsRef.current = existingEvents;
      fullStateRef.current = applyEvents(existingEvents);
      processEvents(existingEvents);
    });

    const unsubEvents = subscribeToEvents(sessionCode, (event) => {
      const alreadyHave = rawEventsRef.current.some((e) => e.id === event.id);
      if (!alreadyHave) {
        rawEventsRef.current = [...rawEventsRef.current, event].sort(
          (a, b) => a.sequence - b.sequence
        );
        fullStateRef.current = applyEvents(rawEventsRef.current);
        processEvents([event]);
      }

      if (event.type === 'GAME_TERMINATED') {
        const terminatorIndex = event.payload.terminatedBy;
        const terminatorNick = nicknames.get(terminatorIndex) ?? '';
        setTerminatedByNickname(terminatorNick !== '' ? terminatorNick : null);
      }
    });

    return () => {
      cleanup();
      unsubEvents();
      setConnected(false);
    };
  }, [sessionCode, secretId, playerIndex, processEvents, nicknames]);

  const makeSeq = useCallback((): (() => number) => {
    let n = rawEventsRef.current.length;
    return () => ++n;
  }, []);

  const pushAction = useCallback(
    async (eventFactory: (state: GameState, seq: () => number) => GameEvent[]) => {
      if (!secretHash) {
        return;
      }
      try {
        const evts = eventFactory(fullStateRef.current, makeSeq());
        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } catch (err) {
        if (err instanceof GameError) {
          console.warn('Game action rejected:', err.message);
        }
      }
    },
    [secretHash, sessionCode, makeSeq]
  );

  const onBid = useCallback(
    (amount: number) =>
      pushAction((s, seq) => createBidPlacedEvents(sessionCode, seq, s, playerIndex, amount)),
    [pushAction, sessionCode, playerIndex]
  );

  const onPass = useCallback(
    () => pushAction((s, seq) => createPlayerPassedEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  const onTakeDabb = useCallback(
    () => pushAction((s, seq) => createTakeDabbEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDiscard = useCallback(
    (cardIds: CardId[]) =>
      pushAction((s, seq) => createDiscardCardsEvents(sessionCode, seq, s, playerIndex, cardIds)),
    [pushAction, sessionCode, playerIndex]
  );

  const onGoOut = useCallback(
    (suit: Suit) =>
      pushAction((s, seq) => createGoOutEvents(sessionCode, seq, s, playerIndex, suit)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDeclareTrump = useCallback(
    (suit: Suit) =>
      pushAction((s, seq) => createDeclareTrumpEvents(sessionCode, seq, s, playerIndex, suit)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDeclareMelds = useCallback(
    (melds: Meld[]) =>
      pushAction((s, seq) =>
        createDeclareMeldsEvents(sessionCode, seq, s, playerIndex, melds, players)
      ),
    [pushAction, sessionCode, playerIndex, players]
  );

  const onPlayCard = useCallback(
    (cardId: CardId) =>
      pushAction((s, seq) =>
        createPlayCardEvents(sessionCode, seq, s, playerIndex, cardId, players)
      ),
    [pushAction, sessionCode, playerIndex, players]
  );

  const onExit = useCallback(
    () => pushAction((s, seq) => createTerminateGameEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  return {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    terminatedByNickname,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
    rawEvents: rawEventsRef.current,
    players,
    aiPlayerIndices: players.filter((p) => p.isAI).map((p) => p.playerIndex),
  };
}
