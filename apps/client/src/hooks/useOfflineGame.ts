/**
 * useOfflineGame — offline game hook that wraps OfflineGameEngine.
 * Implements GameInterface for use with GameScreen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { OfflineGameEngine } from '@dabb/game-ai';
import type { GameInterface } from '@dabb/ui-shared';
import { AI_NAMES } from '@dabb/shared-types';
import type {
  CardId,
  GameEvent,
  GameState,
  Meld,
  PlayerIndex,
  Suit,
  PlayerCount,
} from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';
import { storageGet, storageSet, storageDelete } from './useStorage.js';

const STORAGE_KEY = 'dabb-offline-game';
const HUMAN_PLAYER_INDEX = 0 as PlayerIndex;

export interface UseOfflineGameOptions {
  playerCount: PlayerCount;
  difficulty: AIDifficulty;
  nickname: string;
  /** When true, load existing game from storage rather than starting fresh. */
  resume: boolean;
}

function buildNicknames(
  playerCount: number,
  humanNickname: string,
  humanIndex: PlayerIndex
): Map<PlayerIndex, string> {
  const shuffled = [...AI_NAMES].sort(() => Math.random() - 0.5);
  const map = new Map<PlayerIndex, string>();
  let aiNameIndex = 0;
  for (let i = 0; i < playerCount; i++) {
    const idx = i as PlayerIndex;
    if (idx === humanIndex) {
      map.set(idx, humanNickname);
    } else {
      map.set(idx, shuffled[aiNameIndex++]);
    }
  }
  return map;
}

export function useOfflineGame({
  playerCount,
  difficulty,
  nickname,
  resume,
}: UseOfflineGameOptions): GameInterface {
  const engineRef = useRef<OfflineGameEngine | null>(null);

  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const nicknames = buildNicknames(playerCount, nickname, HUMAN_PLAYER_INDEX);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      let existingEvents: GameEvent[] | undefined;

      if (resume) {
        try {
          const raw = await storageGet(STORAGE_KEY);
          if (raw) {
            const payload = JSON.parse(raw) as { events: GameEvent[] };
            existingEvents = payload.events;
          }
        } catch {
          // Storage read failed — start fresh
        }
      }

      const engine = new OfflineGameEngine({
        playerCount,
        difficulty,
        humanPlayerIndex: HUMAN_PLAYER_INDEX,
        existingEvents,
      });

      engine.onStateChange = (_newState, _newEvents) => {
        if (cancelled) {
          return;
        }
        const view = engine.getViewForPlayer(HUMAN_PLAYER_INDEX);
        setState(view.state);
        setEvents((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          const fresh = view.events.filter((e) => !ids.has(e.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        setIsInitialLoad(false);

        // Persist after every state change
        const payload = engine.getPersistPayload();
        void storageSet(STORAGE_KEY, JSON.stringify(payload));
      };

      engineRef.current = engine;
      await engine.start();

      if (!cancelled) {
        // Populate initial view after start() (resume case where onStateChange didn't fire)
        const view = engine.getViewForPlayer(HUMAN_PLAYER_INDEX);
        setState(view.state);
        setEvents(view.events);
        setIsInitialLoad(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      engineRef.current = null;
    };
  }, []); // Intentionally empty — engine is initialised once on mount

  const dispatch = useCallback(async (action: Parameters<OfflineGameEngine['dispatch']>[0]) => {
    await engineRef.current?.dispatch(action);
  }, []);

  const onBid = useCallback(
    (amount: number) => {
      void dispatch({ type: 'bid', amount });
    },
    [dispatch]
  );
  const onPass = useCallback(() => {
    void dispatch({ type: 'pass' });
  }, [dispatch]);
  const onTakeDabb = useCallback(() => {
    void dispatch({ type: 'takeDabb' });
  }, [dispatch]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => {
      void dispatch({ type: 'discard', cardIds });
    },
    [dispatch]
  );
  const onGoOut = useCallback(
    (suit: Suit) => {
      void dispatch({ type: 'goOut', suit });
    },
    [dispatch]
  );
  const onDeclareTrump = useCallback(
    (suit: Suit) => {
      void dispatch({ type: 'declareTrump', suit });
    },
    [dispatch]
  );
  const onDeclareMelds = useCallback(
    (melds: Meld[]) => {
      void dispatch({ type: 'declareMelds', melds });
    },
    [dispatch]
  );
  const onPlayCard = useCallback(
    (cardId: CardId) => {
      void dispatch({ type: 'playCard', cardId });
    },
    [dispatch]
  );

  const onExit = useCallback(() => {
    engineRef.current = null;
    void storageDelete(STORAGE_KEY);
  }, []);

  // Provide a minimal non-null state so GameScreen doesn't crash before engine starts
  const safeState = state ?? {
    phase: 'waiting' as const,
    playerCount,
    players: [],
    hands: new Map(),
    dabb: [],
    currentBid: 0,
    bidWinner: null,
    currentBidder: null,
    firstBidder: null,
    passedPlayers: new Set(),
    lastBidderIndex: null,
    trump: null,
    currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
    tricksTaken: new Map(),
    currentPlayer: null,
    roundScores: new Map(),
    totalScores: new Map(),
    targetScore: 1000,
    declaredMelds: new Map(),
    dealer: 0 as PlayerIndex,
    round: 1,
    wentOut: false,
    dabbCardIds: [],
    lastCompletedTrick: null,
  };

  return {
    state: safeState,
    events,
    isInitialLoad,
    nicknames,
    connected: true,
    terminatedByNickname: null,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
  };
}
