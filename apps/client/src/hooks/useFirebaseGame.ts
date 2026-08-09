import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameState } from '@dabb/ui-shared';
import type { GameInterface } from '@dabb/ui-shared';
import { applyEvents } from '@dabb/game-logic';
import type {
  AIAction,
  CardId,
  EmoteKey,
  GameEvent,
  GameState,
  PlayerIndex,
  Suit,
} from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';
import { subscribeToEvents, pushEvents, getAllEvents } from '../firebase/events.js';
import { sendEmote, subscribeToEmotes } from '../firebase/emotes.js';
import { useEmotes } from './useEmotes.js';
import { useAIEmotes } from './useAIEmotes.js';
import { hashSecretId } from '../firebase/secretId.js';
import {
  getSessionMeta,
  setupPresence,
  subscribeToPresence,
  subscribeToSessionStatus,
} from '../firebase/session.js';
import type { AIDifficulty } from '@dabb/game-ai';
import { createEventsForAction, createTerminateGameEvents } from '@dabb/game-logic';
import type { NextContext, PlayerInfo } from '@dabb/game-logic';

export interface UseFirebaseGameOptions {
  sessionCode: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

/** An AI seat and the difficulty the host added it with. */
export interface AISeat {
  playerIndex: PlayerIndex;
  difficulty: AIDifficulty;
}

export interface FirebaseGameResult extends GameInterface {
  rawEvents: GameEvent[];
  players: PlayerInfo[];
  aiSeats: AISeat[];
}

/**
 * Which seats count as reachable.
 *
 * Presence alone is not enough. The local player is connected by definition — their own
 * presence write may not have landed yet, and showing yourself as offline would be absurd.
 * AI seats never write presence at all: they are driven by whichever client holds the
 * cascade claim, so reading their missing entry as "disconnected" would mark every bot
 * offline for the whole game.
 */
export function resolveConnectedPlayers(
  presence: Map<PlayerIndex, boolean>,
  aiSeats: AISeat[],
  localPlayerIndex: PlayerIndex
): Set<PlayerIndex> {
  const result = new Set<PlayerIndex>([localPlayerIndex]);
  for (const [idx, isConnected] of presence) {
    if (isConnected) {
      result.add(idx);
    }
  }
  for (const seat of aiSeats) {
    result.add(seat.playerIndex);
  }
  return result;
}

export function useFirebaseGame({
  sessionCode,
  secretId,
  playerIndex,
}: UseFirebaseGameOptions): FirebaseGameResult {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());
  const [terminatedBy, setTerminatedBy] = useState<{ nickname: string | null } | null>(null);
  const [connected, setConnected] = useState(false);
  const [secretHash, setSecretHash] = useState<string>('');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [aiSeats, setAiSeats] = useState<AISeat[]>([]);
  const [presence, setPresence] = useState<Map<PlayerIndex, boolean>>(new Map());

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
      // Sessions created before the difficulty was stored have no aiDifficulty on the
      // player record; those AI seats keep the previous behaviour of playing at medium.
      setAiSeats(
        Object.entries(meta.players)
          .filter(([, p]) => p.isAI)
          .map(([idx, p]) => ({
            playerIndex: Number(idx) as PlayerIndex,
            difficulty: p.aiDifficulty ?? 'medium',
          }))
      );
      const nickMap = new Map<PlayerIndex, string>();
      infos.forEach((p) => nickMap.set(p.playerIndex, p.nickname));
      setNicknames(nickMap);
    });
  }, [sessionCode]);

  useEffect(() => {
    if (!sessionCode) {
      return;
    }
    return subscribeToPresence(sessionCode, setPresence);
  }, [sessionCode]);

  const { visible: emotes, post: postEmote, merge: mergeEmotes } = useEmotes();

  useEffect(() => {
    if (!sessionCode) {
      return;
    }
    return subscribeToEmotes(sessionCode, mergeEmotes);
  }, [sessionCode, mergeEmotes]);

  const aiPlayerIndices = useMemo(() => aiSeats.map((seat) => seat.playerIndex), [aiSeats]);
  useAIEmotes(events, state, aiPlayerIndices, postEmote);

  const onSendEmote = useCallback(
    (key: EmoteKey) => {
      // Echoed locally so the sender sees it immediately rather than after the round trip.
      postEmote(playerIndex, key);
      void sendEmote(sessionCode, playerIndex, key);
    },
    [postEmote, playerIndex, sessionCode]
  );

  const connectedPlayers = useMemo(
    () => resolveConnectedPlayers(presence, aiSeats, playerIndex),
    [presence, aiSeats, playerIndex]
  );

  useEffect(() => {
    if (!sessionCode) {
      return;
    }
    const unsub = subscribeToSessionStatus(sessionCode, (status) => {
      if (status === 'terminated') {
        // The status flag says the game ended but not who ended it; a GAME_TERMINATED
        // event may still arrive with the name.
        setTerminatedBy((prev) => prev ?? { nickname: null });
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
        setTerminatedBy({ nickname: nicknames.get(event.payload.terminatedBy) ?? null });
      }
    });

    return () => {
      cleanup();
      unsubEvents();
      setConnected(false);
    };
  }, [sessionCode, secretId, playerIndex, processEvents, nicknames]);

  /**
   * Sequence numbers continue from the log we have. A single action can emit a whole
   * cascade, so the engine takes a factory and stamps each event it produces.
   */
  const makeNextContext = useCallback((): NextContext => {
    let n = rawEventsRef.current.length;
    return () => ({ sessionId: sessionCode, sequence: ++n });
  }, [sessionCode]);

  const push = useCallback(
    async (build: (state: GameState, next: NextContext) => GameEvent[]) => {
      if (!secretHash) {
        return;
      }
      try {
        const evts = build(fullStateRef.current, makeNextContext());
        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } catch (err) {
        if (err instanceof GameError) {
          console.warn('Game action rejected:', err.message);
        } else {
          // Anything else is a bug, not a rejected move — swallowing it silently strands
          // the game (no events written, no phase advance) with nothing in the console.
          console.error('Game action failed unexpectedly:', err);
        }
      }
    },
    [secretHash, sessionCode, makeNextContext]
  );

  const dispatch = useCallback(
    (action: AIAction) =>
      push((state, next) => createEventsForAction(state, playerIndex, action, next)),
    [push, playerIndex]
  );

  const onBid = useCallback((amount: number) => dispatch({ type: 'bid', amount }), [dispatch]);
  const onPass = useCallback(() => dispatch({ type: 'pass' }), [dispatch]);
  const onTakeDabb = useCallback(() => dispatch({ type: 'takeDabb' }), [dispatch]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => dispatch({ type: 'discard', cardIds }),
    [dispatch]
  );
  const onGoOut = useCallback(() => dispatch({ type: 'goOut' }), [dispatch]);
  const onDeclareTrump = useCallback(
    (suit: Suit) => dispatch({ type: 'declareTrump', suit }),
    [dispatch]
  );
  const onDeclareMelds = useCallback(() => dispatch({ type: 'declareMelds' }), [dispatch]);
  const onPlayCard = useCallback(
    (cardId: CardId) => dispatch({ type: 'playCard', cardId }),
    [dispatch]
  );

  // Not a player action — leaving ends the game for everyone, in any active phase.
  const onExit = useCallback(
    () => push((state, next) => createTerminateGameEvents(state, playerIndex, next)),
    [push, playerIndex]
  );

  return {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    connectedPlayers,
    terminatedBy,
    emotes,
    onSendEmote,
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
    aiSeats,
  };
}
