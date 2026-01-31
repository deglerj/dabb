/**
 * Hook to convert game events to log entries for display
 */

import { useMemo } from 'react';
import type { GameEvent, GameLogEntry, GameState, PlayerIndex } from '@dabb/shared-types';

const DEFAULT_VISIBLE_ENTRIES = 5;

export interface GameLogResult {
  /** All log entries in reverse chronological order (newest first) */
  entries: GameLogEntry[];
  /** The latest N entries for collapsed view */
  latestEntries: GameLogEntry[];
  /** Whether it's the current player's turn */
  isYourTurn: boolean;
}

/**
 * Converts game events to displayable log entries
 * Skips secret events (CARDS_DEALT, DABB_TAKEN, CARDS_DISCARDED, MELDING_COMPLETE)
 */
export function useGameLog(
  events: GameEvent[],
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): GameLogResult {
  return useMemo(() => {
    const entries: GameLogEntry[] = [];

    for (const event of events) {
      const logEntry = eventToLogEntry(event);
      if (logEntry) {
        entries.push(logEntry);
      }
    }

    // Reverse to get newest first
    const reversedEntries = [...entries].reverse();

    // Determine if it's the current player's turn
    const isYourTurn =
      currentPlayerIndex !== null &&
      state !== null &&
      state.currentPlayer === currentPlayerIndex &&
      (state.phase === 'bidding' || state.phase === 'tricks');

    return {
      entries: reversedEntries,
      latestEntries: reversedEntries.slice(0, DEFAULT_VISIBLE_ENTRIES),
      isYourTurn,
    };
  }, [events, state, currentPlayerIndex]);
}

/**
 * Converts a single game event to a log entry
 * Returns null for secret events that shouldn't be logged
 */
function eventToLogEntry(event: GameEvent): GameLogEntry | null {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_started',
        playerIndex: null,
        data: {
          kind: 'game_started',
          playerCount: event.payload.playerCount,
          targetScore: event.payload.targetScore,
        },
      };

    case 'NEW_ROUND_STARTED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'round_started',
        playerIndex: null,
        data: {
          kind: 'round_started',
          round: event.payload.round,
        },
      };

    case 'BID_PLACED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'bid_placed',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'bid_placed',
          amount: event.payload.amount,
        },
      };

    case 'PLAYER_PASSED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'player_passed',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'player_passed',
        },
      };

    case 'BIDDING_WON':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'bidding_won',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'bidding_won',
          winningBid: event.payload.winningBid,
        },
      };

    case 'GOING_OUT':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'going_out',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'going_out',
          suit: event.payload.suit,
        },
      };

    case 'TRUMP_DECLARED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'trump_declared',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'trump_declared',
          suit: event.payload.suit,
        },
      };

    case 'MELDS_DECLARED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'melds_declared',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'melds_declared',
          melds: event.payload.melds,
          totalPoints: event.payload.totalPoints,
        },
      };

    case 'CARD_PLAYED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'card_played',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'card_played',
          card: event.payload.card,
        },
      };

    case 'TRICK_WON':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'trick_won',
        playerIndex: event.payload.winnerIndex,
        data: {
          kind: 'trick_won',
          points: event.payload.points,
        },
      };

    case 'ROUND_SCORED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'round_scored',
        playerIndex: null,
        data: {
          kind: 'round_scored',
          scores: event.payload.scores,
        },
      };

    case 'GAME_FINISHED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_finished',
        playerIndex: null,
        data: {
          kind: 'game_finished',
          winner: event.payload.winner,
        },
      };

    case 'GAME_TERMINATED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_terminated',
        playerIndex: event.payload.terminatedBy,
        data: {
          kind: 'game_terminated',
          reason: event.payload.reason,
        },
      };

    // Secret events that shouldn't be logged
    case 'CARDS_DEALT':
    case 'DABB_TAKEN':
    case 'CARDS_DISCARDED':
    case 'MELDING_COMPLETE':
    case 'PLAYER_JOINED':
    case 'PLAYER_LEFT':
    case 'PLAYER_RECONNECTED':
      return null;

    default:
      return null;
  }
}
