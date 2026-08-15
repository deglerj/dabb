/**
 * Hook to determine what to announce at the end of a round or game.
 *
 * - roundOutcome: how the last scored round ended, for every player — the bid winner's side
 *   met the bid or missed it, and whether that side is the local player's. Only the local
 *   win gets confetti; the other three outcomes are announced as plain overlay text.
 * - Fireworks: When the current player wins the game
 *
 * Note: ROUND_SCORED and NEW_ROUND_STARTED events arrive in the same batch from the server,
 * so we track which round produced the outcome and only clear it when a NEW round is scored.
 *
 * The round number is part of the result so consumers can detect a NEW outcome even when two
 * rounds in a row end the same way (an unchanged value would not re-trigger effects).
 */

import { useMemo } from 'react';
import type { GameEvent, PlayerIndex, Team } from '@dabb/shared-types';

export interface RoundOutcome {
  /** Round this outcome belongs to; changes on every newly scored round. */
  round: number;
  /** True if the bid winner's side made their bid. */
  bidMet: boolean;
  /** True if the local player (or, in a 4-player game, their team) held the bid. */
  isLocalSide: boolean;
  /** Seat of the bid winner, for naming them in the announcement. */
  bidWinner: PlayerIndex;
}

export interface CelebrationResult {
  roundOutcome: RoundOutcome | null;
  showFireworks: boolean;
}

export function useCelebration(
  events: GameEvent[],
  playerIndex: PlayerIndex | null,
  /** Events already in the log when this client joined — announcing those is replay. */
  replayedEventIds: Set<string>
): CelebrationResult {
  return useMemo(() => {
    if (playerIndex === null) {
      return { roundOutcome: null, showFireworks: false };
    }

    let roundOutcome: RoundOutcome | null = null;
    let showFireworks = false;
    let lastBidWinner: PlayerIndex | null = null;
    let lastBidWinnerTeam: Team | null = null;
    let gameFinished = false;
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
          showFireworks = false;
          lastBidWinner = null;
          lastBidWinnerTeam = null;
          gameFinished = false;
          roundOutcome = null;
          currentRound = 1;
          break;

        case 'NEW_ROUND_STARTED':
          currentRound = event.payload.round;
          lastBidWinner = null;
          lastBidWinnerTeam = null;
          // Only clear the announcement if it came from a previous round
          // (not the current scoring → new round transition)
          if (roundOutcome !== null && roundOutcome.round < currentRound - 1) {
            roundOutcome = null;
          }
          break;

        case 'BIDDING_WON':
          lastBidWinner = event.payload.playerIndex;
          lastBidWinnerTeam = playerTeams.get(lastBidWinner) ?? null;
          break;

        case 'ROUND_SCORED': {
          // Drop any previous round's announcement before checking this round
          if (roundOutcome !== null && roundOutcome.round < currentRound) {
            roundOutcome = null;
          }

          // A round scored before we joined is history — no announcement for it.
          if (lastBidWinner === null || gameFinished || replayedEventIds.has(event.id)) {
            break;
          }

          const currentPlayerTeam = playerTeams.get(playerIndex) ?? null;

          // Is the local player on the side that held the bid?
          const isLocalSide =
            currentPlayerTeam !== null
              ? currentPlayerTeam === lastBidWinnerTeam // 4-player: team holds the bid
              : lastBidWinner === playerIndex; // 2/3-player: individual holds it

          // bidMet is only meaningful on the bid winner's own score entry — everyone
          // else is scored with bidMet: true regardless of how the round went.
          const bidSideKey: PlayerIndex | Team | null =
            currentPlayerTeam !== null ? lastBidWinnerTeam : lastBidWinner;
          if (bidSideKey === null) {
            break;
          }

          roundOutcome = {
            round: currentRound,
            bidMet: event.payload.scores[bidSideKey]?.bidMet ?? false,
            isLocalSide,
            bidWinner: lastBidWinner,
          };
          break;
        }

        case 'GAME_FINISHED': {
          // Check if the current player won the game
          // Stop the round announcement if the game ends (the game result takes over)
          roundOutcome = null;
          const currentPlayerTeam = playerTeams.get(playerIndex) ?? null;
          const playerWon =
            currentPlayerTeam !== null
              ? event.payload.winner === currentPlayerTeam
              : event.payload.winner === playerIndex;
          if (playerWon && !replayedEventIds.has(event.id)) {
            showFireworks = true;
          }
          gameFinished = true;
          break;
        }

        case 'GAME_TERMINATED':
          // Game terminated, stop all announcements
          showFireworks = false;
          roundOutcome = null;
          break;
      }
    }

    return { roundOutcome, showFireworks };
  }, [events, playerIndex, replayedEventIds]);
}
