/**
 * Hook to compute round history from game events
 */

import { useMemo } from 'react';
import type { GameEvent, PlayerIndex, Team, RoundHistoryEntry } from '@dabb/shared-types';

export interface RoundHistoryResult {
  rounds: RoundHistoryEntry[];
  currentRound: {
    round: number;
    bidWinner: PlayerIndex | null;
    winningBid: number;
    meldScores: Record<PlayerIndex, number> | null;
  } | null;
  gameWinner: PlayerIndex | Team | null;
}

export function useRoundHistory(events: GameEvent[]): RoundHistoryResult {
  return useMemo(() => {
    const rounds: RoundHistoryEntry[] = [];
    let currentRound: {
      round: number;
      bidWinner: PlayerIndex | null;
      winningBid: number;
      meldScores: Record<PlayerIndex, number> | null;
    } | null = null;
    let gameWinner: PlayerIndex | Team | null = null;

    // Temporary state for building current round
    let roundNumber = 1;
    let bidWinner: PlayerIndex | null = null;
    let winningBid = 0;
    let meldScores: Record<PlayerIndex, number> = {} as Record<PlayerIndex, number>;

    for (const event of events) {
      switch (event.type) {
        case 'GAME_STARTED':
          roundNumber = 1;
          bidWinner = null;
          winningBid = 0;
          meldScores = {} as Record<PlayerIndex, number>;
          break;

        case 'NEW_ROUND_STARTED':
          roundNumber = event.payload.round;
          bidWinner = null;
          winningBid = 0;
          meldScores = {} as Record<PlayerIndex, number>;
          break;

        case 'BIDDING_WON':
          bidWinner = event.payload.playerIndex;
          winningBid = event.payload.winningBid;
          break;

        case 'MELDS_DECLARED':
          // Track individual player meld declarations
          meldScores[event.payload.playerIndex] = event.payload.totalPoints;
          break;

        case 'MELDING_COMPLETE':
          // All meld scores finalized
          meldScores = event.payload.meldScores as Record<PlayerIndex, number>;
          break;

        case 'ROUND_SCORED':
          // Complete the current round entry
          rounds.push({
            round: roundNumber,
            bidWinner,
            winningBid,
            scores: event.payload.scores as Record<
              PlayerIndex | Team,
              { melds: number; tricks: number; total: number; bidMet: boolean }
            >,
          });
          // Reset meld scores for next round
          meldScores = {} as Record<PlayerIndex, number>;
          break;

        case 'GAME_FINISHED':
          gameWinner = event.payload.winner;
          break;
      }
    }

    // Set current round info if we have bid data but round isn't scored yet
    if (bidWinner !== null) {
      const lastScoredRound = rounds.length > 0 ? rounds[rounds.length - 1].round : 0;
      if (roundNumber > lastScoredRound) {
        const hasMelds = Object.keys(meldScores).length > 0;
        currentRound = {
          round: roundNumber,
          bidWinner,
          winningBid,
          meldScores: hasMelds ? meldScores : null,
        };
      }
    }

    // If no current round with bid, check if we're in a round at all
    if (!currentRound && roundNumber > 0) {
      const lastScoredRound = rounds.length > 0 ? rounds[rounds.length - 1].round : 0;
      if (roundNumber > lastScoredRound) {
        currentRound = { round: roundNumber, bidWinner: null, winningBid: 0, meldScores: null };
      }
    }

    return { rounds, currentRound, gameWinner };
  }, [events]);
}
