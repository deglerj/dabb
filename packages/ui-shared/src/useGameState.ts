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
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerIndex, initialPlayerCount = 4 } = options;

  // Unfiltered log is kept because filtering is not incremental — see processEvents.
  const [, setRawEvents] = useState<GameEvent[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [state, setState] = useState<GameState>(() => createInitialState(initialPlayerCount));

  const processEvents = useCallback(
    (newEvents: GameEvent[]) => {
      setRawEvents((prev) => {
        // Deduplicate by event ID
        const existingIds = new Set(prev.map((e) => e.id));
        const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id));

        if (uniqueNewEvents.length === 0) {
          return prev;
        }

        const combined = [...prev, ...uniqueNewEvents].sort((a, b) => a.sequence - b.sequence);

        // Filter the whole log, not just the new batch: revealing the bid winner's buried
        // trump needs the trump suit from an earlier event, so a batch on its own is not
        // enough context. Rebuilding state already walks every event anyway.
        const filtered = filterEventsForPlayer(combined, playerIndex);
        setEvents(filtered);
        setState(applyEvents(filtered));

        return combined;
      });
    },
    [playerIndex]
  );

  return {
    state,
    events,
    processEvents,
  };
}
