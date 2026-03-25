/**
 * Event-sourced game state hook
 */

import { useState, useCallback, useEffect } from 'react';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { applyEvents, createInitialState, filterEventsForPlayer } from '@dabb/game-logic';

interface UseGameStateOptions {
  playerIndex: PlayerIndex;
  initialPlayerCount?: 2 | 3 | 4;
}

interface UseGameStateReturn {
  state: GameState;
  events: GameEvent[];
  isInitialLoad: boolean;
  processEvents: (newEvents: GameEvent[]) => void;
  reset: () => void;
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerIndex, initialPlayerCount = 4 } = options;

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [state, setState] = useState<GameState>(() => createInitialState(initialPlayerCount));
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const processEvents = useCallback(
    (newEvents: GameEvent[]) => {
      // Filter events for this player's view
      const filteredEvents = filterEventsForPlayer(newEvents, playerIndex);

      setEvents((prev) => {
        // Deduplicate by event ID
        const existingIds = new Set(prev.map((e) => e.id));
        const uniqueNewEvents = filteredEvents.filter((e) => !existingIds.has(e.id));

        if (uniqueNewEvents.length === 0) {
          return prev;
        }

        const combined = [...prev, ...uniqueNewEvents].sort((a, b) => a.sequence - b.sequence);

        // Rebuild state from all events
        const newState = applyEvents(combined);
        setState(newState);

        return combined;
      });
    },
    [playerIndex]
  );

  // Clear isInitialLoad after the first event batch settles.
  // React state updates from within useEffect are applied after all effects in the
  // current render finish — so isInitialLoad remains true for all sibling effects
  // (e.g. the sound/haptic effect in GameScreen) during the render where events
  // first arrive. Using the functional updater avoids adding isInitialLoad to the
  // dependency array (which would cause an ESLint exhaustive-deps warning).
  useEffect(() => {
    if (events.length > 0) {
      setIsInitialLoad((prev) => (prev ? false : prev));
    }
  }, [events]);

  const reset = useCallback(() => {
    setEvents([]);
    setState(createInitialState(initialPlayerCount));
    setIsInitialLoad(true);
  }, [initialPlayerCount]);

  return {
    state,
    events,
    isInitialLoad,
    processEvents,
    reset,
  };
}
