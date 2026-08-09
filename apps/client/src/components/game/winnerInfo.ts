/**
 * Who won the finished game, resolved for display in the end-of-game modal.
 */
import { determineGameWinner } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Team } from '@dabb/shared-types';

export interface WinnerInfo {
  winnerId: string | null;
  /** Both partners in a 4-player game, in seat order; a single name otherwise. */
  winnerNicknames: string[];
  isLocalWinner: boolean;
}

/**
 * Resolves the winner through determineGameWinner rather than taking the first player over
 * the target score. Several players (or both teams) can cross in the same round, in which
 * case the highest total wins and an exact tie goes to the bid winner — picking the first one
 * past the line names someone the round was not actually settled in favour of.
 *
 * Returns null while the game is still running.
 */
export function deriveWinnerInfo(
  state: GameState,
  nicknames: Map<PlayerIndex, string>,
  localPlayerIndex: PlayerIndex
): WinnerInfo | null {
  if (state.phase !== 'finished') {
    return null;
  }

  const isTeamGame = state.playerCount === 4;
  const candidates: (PlayerIndex | Team)[] = isTeamGame
    ? [0, 1]
    : Array.from({ length: state.playerCount }, (_, i) => i as PlayerIndex);
  const bidWinnerKey =
    state.bidWinner === null
      ? null
      : isTeamGame
        ? (state.players.find((p) => p.playerIndex === state.bidWinner)?.team ?? null)
        : state.bidWinner;

  const winner = determineGameWinner(
    Object.fromEntries(state.totalScores),
    candidates,
    state.targetScore,
    bidWinnerKey
  );
  if (winner === null) {
    return null;
  }

  const winners = state.players
    .filter((p) => (isTeamGame ? p.team === winner : p.playerIndex === winner))
    .sort((a, b) => a.playerIndex - b.playerIndex);
  if (winners.length === 0) {
    return null;
  }

  return {
    winnerId: winners[0].id,
    winnerNicknames: winners.map((p) => nicknames.get(p.playerIndex) ?? p.nickname),
    isLocalWinner: winners.some((p) => p.playerIndex === localPlayerIndex),
  };
}
