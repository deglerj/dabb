/**
 * Event-sourced game state hook
 */

import { useState, useCallback } from 'react';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { applyEvents, createInitialState, filterEventsForPlayer } from '@dabb/game-logic';

interface UseGameStateOptions {
  playerIndex: PlayerIndex;
  initialPlayerCount?: 2 | 3 | 4;
}

interface UseGameStateReturn {
  state: GameState;
  events: GameEvent[];
  processEvents: (newEvents: GameEvent[]) => void;
  reset: () => void;
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerIndex, initialPlayerCount = 4 } = options;

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [state, setState] = useState<GameState>(() =>
    createInitialState(initialPlayerCount)
  );

  const processEvents = useCallback((newEvents: GameEvent[]) => {
    // Filter events for this player's view
    const filteredEvents = filterEventsForPlayer(newEvents, playerIndex);

    setEvents(prev => {
      // Deduplicate by event ID
      const existingIds = new Set(prev.map(e => e.id));
      const uniqueNewEvents = filteredEvents.filter(e => !existingIds.has(e.id));

      if (uniqueNewEvents.length === 0) {
        return prev;
      }

      const combined = [...prev, ...uniqueNewEvents].sort(
        (a, b) => a.sequence - b.sequence
      );

      // Rebuild state from all events
      const newState = applyEvents(combined);
      setState(newState);

      return combined;
    });
  }, [playerIndex]);

  const reset = useCallback(() => {
    setEvents([]);
    setState(createInitialState(initialPlayerCount));
  }, [initialPlayerCount]);

  return {
    state,
    events,
    processEvents,
    reset,
  };
}
