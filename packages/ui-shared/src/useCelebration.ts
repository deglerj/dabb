/**
 * Hook to determine when to show celebration animations
 *
 * - Confetti: When the current player wins a round (was bid winner AND met their bid)
 * - Fireworks: When the current player wins the game
 *
 * Note: ROUND_SCORED and NEW_ROUND_STARTED events arrive in the same batch from the server,
 * so we track which round triggered the confetti and only clear it when a NEW round is scored.
 */

import { useMemo } from 'react';
import type { GameEvent, PlayerIndex, Team } from '@dabb/shared-types';

export interface CelebrationResult {
  showConfetti: boolean;
  showFireworks: boolean;
}

export function useCelebration(
  events: GameEvent[],
  playerIndex: PlayerIndex | null
): CelebrationResult {
  return useMemo(() => {
    if (playerIndex === null) {
      return { showConfetti: false, showFireworks: false };
    }

    let showConfetti = false;
    let showFireworks = false;
    let lastBidWinner: PlayerIndex | null = null;
    let lastBidWinnerTeam: Team | null = null;
    let gameFinished = false;
    let confettiRound = 0; // Track which round triggered confetti
    let currentRound = 1;
    const playerTeams = new Map<PlayerIndex, Team>();

    for (const event of events) {
      switch (event.type) {
        case 'PLAYER_JOINED':
          if (event.payload.team !== undefined) {
            playerTeams.set(event.payload.playerIndex, event.payload.team);
          }
          break;

        case 'GAME_STARTED':
          // Reset at game start
          showConfetti = false;
          showFireworks = false;
          lastBidWinner = null;
          lastBidWinnerTeam = null;
          gameFinished = false;
          confettiRound = 0;
          currentRound = 1;
          break;

        case 'NEW_ROUND_STARTED':
          currentRound = event.payload.round;
          lastBidWinner = null;
          lastBidWinnerTeam = null;
          // Only clear confetti if it was triggered in a previous round
          // (not the current scoring → new round transition)
          if (confettiRound > 0 && confettiRound < currentRound - 1) {
            showConfetti = false;
            confettiRound = 0;
          }
          break;

        case 'BIDDING_WON':
          lastBidWinner = event.payload.playerIndex;
          lastBidWinnerTeam = playerTeams.get(lastBidWinner) ?? null;
          break;

        case 'ROUND_SCORED': {
          // Clear any previous round's confetti before checking this round
          if (confettiRound > 0 && confettiRound < currentRound) {
            showConfetti = false;
            confettiRound = 0;
          }

          const currentPlayerTeam = playerTeams.get(playerIndex) ?? null;

          // Determine if current player is on the winning side
          const isOnWinningSide =
            currentPlayerTeam !== null
              ? currentPlayerTeam === lastBidWinnerTeam // 4-player: team wins
              : lastBidWinner === playerIndex; // 2/3-player: individual wins

          const sideKey =
            currentPlayerTeam !== null
              ? (currentPlayerTeam as PlayerIndex | Team)
              : (playerIndex as PlayerIndex | Team);
          const sideScore = event.payload.scores[sideKey];

          if (isOnWinningSide && sideScore?.bidMet && !gameFinished) {
            showConfetti = true;
            confettiRound = currentRound;
          }
          break;
        }

        case 'GAME_FINISHED': {
          // Check if the current player won the game
          // Stop confetti if game ends (fireworks take over)
          showConfetti = false;
          confettiRound = 0;
          const currentPlayerTeam = playerTeams.get(playerIndex) ?? null;
          const playerWon =
            currentPlayerTeam !== null
              ? event.payload.winner === currentPlayerTeam
              : event.payload.winner === playerIndex;
          if (playerWon) {
            showFireworks = true;
          }
          gameFinished = true;
          break;
        }

        case 'GAME_TERMINATED':
          // Game terminated, stop all celebrations
          showConfetti = false;
          showFireworks = false;
          confettiRound = 0;
          break;
      }
    }

    return { showConfetti, showFireworks };
  }, [events, playerIndex]);
}
