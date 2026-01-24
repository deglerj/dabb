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
  applyEvents: (events: GameEvent[]) => void;
  reset: () => void;
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerCount, playerIndex } = options;

  const [state, dispatch] = useReducer(
    (
      currentState: GameState,
      action: { type: 'APPLY_EVENTS'; events: GameEvent[] } | { type: 'RESET' }
    ) => {
      if (action.type === 'RESET') {
        return createInitialState(playerCount);
      }

      let newState = currentState;
      for (const event of action.events) {
        const filteredEvent = filterEventForPlayer(event, playerIndex);
        newState = applyEvent(newState, filteredEvent);
      }
      return newState;
    },
    createInitialState(playerCount)
  );

  const applyEvents = useCallback((events: GameEvent[]) => {
    dispatch({ type: 'APPLY_EVENTS', events });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, applyEvents, reset };
}
