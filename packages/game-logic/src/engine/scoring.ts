/**
 * Settling a round: what everyone scored, and whether that ended the game.
 *
 * This was previously written out three times — in the client's event factory, in the
 * offline engine and in the simulation engine — with the copies drifting apart. The rules
 * live here now and every engine ends its rounds through these two entry points.
 */

import type {
  GameEvent,
  GameState,
  PlayerIndex,
  RoundScoreEntry,
  RoundScores,
  Team,
} from '@dabb/shared-types';
import { calculateMeldPoints } from '../melds/index.js';
import { calculatePlayerTrickRawPoints } from '../phases/index.js';
import {
  createGameFinishedEvent,
  createNewRoundStartedEvent,
  createRoundScoredEvent,
} from '../events/index.js';
import { determineGameWinner } from '../state/winner.js';
import { createDealEvent } from './deal.js';
import type { NextContext } from './context.js';

/** Opponents of a bid winner who went out split melds plus this. */
const GOING_OUT_BONUS = 40;

/** Falls back to the opening bid: a round can only be scored after someone won the bidding. */
function winningBidOf(state: GameState): number {
  return state.currentBid || 150;
}

function isTeamGame(state: GameState): boolean {
  return state.playerCount === 4;
}

/**
 * Team lookups read `state.players`, populated from PLAYER_JOINED. The PlayerInfo lists the
 * client keeps from Firebase session meta have no team field and must not be used here.
 */
function getPlayerTeam(state: GameState, playerIndex: PlayerIndex): Team {
  const team = state.players.find((p) => p.playerIndex === playerIndex)?.team;
  if (team === undefined) {
    throw new Error(`Player ${playerIndex} has no team in a ${state.playerCount}-player game`);
  }
  return team;
}

function getTeamPlayerIndices(state: GameState, team: Team): PlayerIndex[] {
  return state.players.filter((p) => p.team === team).map((p) => p.playerIndex);
}

/** The scoring keys for this game: both teams, or every seat. */
function scoringKeys(state: GameState): (PlayerIndex | Team)[] {
  return isTeamGame(state)
    ? [0, 1]
    : Array.from({ length: state.playerCount }, (_, i) => i as PlayerIndex);
}

/** The bid winner expressed in whatever the game scores by. */
function bidWinnerKey(state: GameState): PlayerIndex | Team | null {
  if (state.bidWinner === null) {
    return null;
  }
  return isTeamGame(state) ? getPlayerTeam(state, state.bidWinner) : state.bidWinner;
}

/**
 * Applies the missed-bid rule: the bid winner forfeits melds and tricks alike and takes
 * -2 × their bid, which is what makes going out (-1 × bid) worth choosing.
 */
function settle(
  melds: number,
  tricks: number,
  isBidWinner: boolean,
  winningBid: number
): RoundScoreEntry {
  const rawTotal = melds + tricks;
  const bidMet = !isBidWinner || rawTotal >= winningBid;
  return {
    melds,
    tricks,
    total: isBidWinner && !bidMet ? -2 * winningBid : rawTotal,
    bidMet,
  };
}

/** Binokel rule: trick points are rounded to the nearest ten, with five rounding up. */
function roundTrickPoints(raw: number): number {
  return Math.round(raw / 10) * 10;
}

function playerTrickRaw(state: GameState, playerIndex: PlayerIndex): number {
  return calculatePlayerTrickRawPoints(
    playerIndex,
    state.tricksTaken,
    state.lastCompletedTrick?.winnerIndex ?? null
  );
}

/** Scores a round that was played out to the last trick. */
function tallyPlayedRound(state: GameState): RoundScores {
  const winningBid = winningBidOf(state);
  const scores = {} as RoundScores;

  if (isTeamGame(state)) {
    const bidWinnerTeam = getPlayerTeam(state, state.bidWinner!);
    for (const team of [0, 1] as Team[]) {
      const indices = getTeamPlayerIndices(state, team);
      const teamMelds = indices.reduce<number>(
        (sum, idx) => sum + calculateMeldPoints(state.declaredMelds.get(idx) ?? []),
        0
      );
      // Round the team's trick total once — rounding each player first would inflate
      // the team score and break the 250-points-per-round invariant.
      const teamTricksRaw = indices.reduce<number>(
        (sum, idx) => sum + playerTrickRaw(state, idx),
        0
      );
      scores[team] = settle(
        teamMelds,
        roundTrickPoints(teamTricksRaw),
        team === bidWinnerTeam,
        winningBid
      );
    }
    return scores;
  }

  for (let i = 0; i < state.playerCount; i++) {
    const idx = i as PlayerIndex;
    scores[idx] = settle(
      calculateMeldPoints(state.declaredMelds.get(idx) ?? []),
      roundTrickPoints(playerTrickRaw(state, idx)),
      idx === state.bidWinner,
      winningBid
    );
  }
  return scores;
}

/**
 * Scores a round the bid winner went out of: they lose their bid once, and everyone else
 * keeps their melds plus the bonus. No tricks are played, so nothing else is counted.
 */
function tallyGoingOut(state: GameState, meldScores: Record<PlayerIndex, number>): RoundScores {
  const winningBid = winningBidOf(state);
  const bidWinner = state.bidWinner!;
  const scores = {} as RoundScores;

  if (isTeamGame(state)) {
    const bidWinnerTeam = getPlayerTeam(state, bidWinner);
    const opponentTeam = (1 - bidWinnerTeam) as Team;
    scores[bidWinnerTeam] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };

    const opponentMelds = getTeamPlayerIndices(state, opponentTeam).reduce<number>(
      (sum, idx) => sum + (meldScores[idx] ?? 0),
      0
    );
    scores[opponentTeam] = {
      melds: opponentMelds,
      tricks: 0,
      total: opponentMelds + GOING_OUT_BONUS,
      bidMet: true,
    };
    return scores;
  }

  for (let i = 0; i < state.playerCount; i++) {
    const idx = i as PlayerIndex;
    if (idx === bidWinner) {
      scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
    } else {
      const melds = meldScores[idx] ?? 0;
      scores[idx] = { melds, tricks: 0, total: melds + GOING_OUT_BONUS, bidMet: true };
    }
  }
  return scores;
}

/**
 * Emits ROUND_SCORED, then either GAME_FINISHED or the start of the next round.
 *
 * Whether the game is over goes through determineGameWinner: several players can cross the
 * target in the same round, the highest total wins, and an exact tie goes to the bid winner.
 */
function closeRound(state: GameState, scores: RoundScores, next: NextContext): GameEvent[] {
  const keys = scoringKeys(state);
  const totalScores = {} as Record<PlayerIndex | Team, number>;
  for (const key of keys) {
    totalScores[key] = (state.totalScores.get(key) ?? 0) + scores[key].total;
  }

  const events: GameEvent[] = [createRoundScoredEvent(next(), scores, totalScores)];

  const winner = determineGameWinner(totalScores, keys, state.targetScore, bidWinnerKey(state));
  if (winner !== null) {
    events.push(createGameFinishedEvent(next(), winner, totalScores));
    return events;
  }

  const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
  events.push(createNewRoundStartedEvent(next(), state.round + 1, newDealer));
  events.push(createDealEvent(next, state.playerCount));
  return events;
}

/**
 * Settles a round that was played to the last trick and starts the next one, or ends the
 * game. Call once every hand is empty.
 */
export function createRoundEndEvents(state: GameState, next: NextContext): GameEvent[] {
  return closeRound(state, tallyPlayedRound(state), next);
}

/**
 * Settles a round the bid winner went out of. Call once the remaining players have melded.
 */
export function createGoingOutScoreEvents(
  state: GameState,
  meldScores: Record<PlayerIndex, number>,
  next: NextContext
): GameEvent[] {
  return closeRound(state, tallyGoingOut(state, meldScores), next);
}
