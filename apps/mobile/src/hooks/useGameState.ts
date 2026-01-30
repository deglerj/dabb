/**
 * Game state hook using event sourcing
 */

import { useReducer, useCallback } from 'react';
import { applyEvent, createInitialState, filterEventForPlayer } from '@dabb/game-logic';
import type { GameEvent, GameState, PlayerCount, PlayerIndex } from '@dabb/shared-types';

interface UseGameStateOptions {
  playerCount: PlayerCount;
  playerIndex: PlayerIndex;
}

interface UseGameStateReturn {
  state: GameState;
  events: GameEvent[];
  applyEvents: (events: GameEvent[]) => void;
  reset: () => void;
}

interface StateWithEvents {
  gameState: GameState;
  events: GameEvent[];
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerCount, playerIndex } = options;

  const [{ gameState, events }, dispatch] = useReducer(
    (
      current: StateWithEvents,
      action: { type: 'APPLY_EVENTS'; events: GameEvent[] } | { type: 'RESET' }
    ): StateWithEvents => {
      if (action.type === 'RESET') {
        return { gameState: createInitialState(playerCount), events: [] };
      }

      let newState = current.gameState;
      for (const event of action.events) {
        const filteredEvent = filterEventForPlayer(event, playerIndex);
        newState = applyEvent(newState, filteredEvent);
      }
      return { gameState: newState, events: [...current.events, ...action.events] };
    },
    { gameState: createInitialState(playerCount), events: [] }
  );

  const applyEventsCallback = useCallback((newEvents: GameEvent[]) => {
    dispatch({ type: 'APPLY_EVENTS', events: newEvents });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state: gameState, events, applyEvents: applyEventsCallback, reset };
}
