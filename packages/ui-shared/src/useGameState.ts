/**
 * Event-sourced game state hook
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import {
  applyEvents,
  createEventStore,
  filterEventsForPlayer,
  type EventStoreResult,
} from '@dabb/game-logic';

interface UseGameStateOptions {
  playerIndex: PlayerIndex;
  initialPlayerCount?: 2 | 3 | 4;
  resetKey?: string;
}

interface UseGameStateReturn {
  state: GameState;
  fullState: GameState;
  events: GameEvent[];
  rawEvents: GameEvent[];
  processEvents: (newEvents: GameEvent[]) => EventStoreResult;
  replaceEvents: (snapshot: GameEvent[]) => EventStoreResult;
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerIndex, initialPlayerCount = 4, resetKey } = options;
  const store = useMemo(() => createEventStore(initialPlayerCount), [initialPlayerCount, resetKey]);
  const [projection, setProjection] = useState(() => {
    const rawEvents = store.getEvents();
    return {
      rawEvents,
      events: filterEventsForPlayer(rawEvents, playerIndex),
      state: applyEvents(filterEventsForPlayer(rawEvents, playerIndex)),
      fullState: store.getState(),
    };
  });

  useEffect(() => {
    const rawEvents = store.getEvents();
    setProjection({
      rawEvents,
      events: filterEventsForPlayer(rawEvents, playerIndex),
      state: applyEvents(filterEventsForPlayer(rawEvents, playerIndex)),
      fullState: store.getState(),
    });
  }, [playerIndex, store]);

  const publish = useCallback(
    (result: EventStoreResult): EventStoreResult => {
      const rawEvents = result.events;
      const events = filterEventsForPlayer(rawEvents, playerIndex);
      setProjection({ rawEvents, events, state: applyEvents(events), fullState: result.state });
      return result;
    },
    [playerIndex]
  );

  const processEvents = useCallback(
    (newEvents: GameEvent[]) => {
      let result: EventStoreResult | undefined;
      let appliedResult: EventStoreResult | undefined;
      for (const event of newEvents) {
        result = store.accept(event);
        if (result.status === 'applied') {
          appliedResult = result;
        }
      }
      if (appliedResult) {
        publish(appliedResult);
      }
      return (
        result ?? {
          status: 'duplicate',
          events: store.getEvents(),
          state: store.getState(),
          newlyApplied: [],
          missingSequences: [],
          conflictingSequences: [],
        }
      );
    },
    [publish, store]
  );

  const replaceEvents = useCallback(
    (snapshot: GameEvent[]) => publish(store.replaceSnapshot(snapshot)),
    [publish, store]
  );

  return {
    state: projection.state,
    fullState: projection.fullState,
    events: projection.events,
    rawEvents: projection.rawEvents,
    processEvents,
    replaceEvents,
  };
}
