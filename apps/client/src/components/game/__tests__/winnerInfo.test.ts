import { describe, expect, it } from 'vitest';
import type { GameState, PlayerIndex, Player, Team } from '@dabb/shared-types';
import { deriveWinnerInfo } from '../winnerInfo.js';

function player(playerIndex: number, nickname: string, team?: Team): Player {
  return {
    id: `p${playerIndex}`,
    nickname,
    playerIndex: playerIndex as PlayerIndex,
    ...(team === undefined ? {} : { team }),
  } as Player;
}

function makeState(overrides: Partial<GameState>): GameState {
  return {
    phase: 'finished',
    playerCount: 3,
    players: [player(0, 'Alice'), player(1, 'Bob'), player(2, 'Carol')],
    targetScore: 1000,
    bidWinner: null,
    totalScores: new Map(),
    ...overrides,
  } as unknown as GameState;
}

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
  [2 as PlayerIndex, 'Carol'],
]);

describe('deriveWinnerInfo', () => {
  it('returns null while the game is still running', () => {
    const state = makeState({ phase: 'tricks', totalScores: new Map([[0 as PlayerIndex, 1200]]) });
    expect(deriveWinnerInfo(state, nicknames, 0 as PlayerIndex)).toBeNull();
  });

  it('names the only player over the target', () => {
    const state = makeState({
      totalScores: new Map<PlayerIndex, number>([
        [0 as PlayerIndex, 640],
        [1 as PlayerIndex, 1030],
        [2 as PlayerIndex, 720],
      ]),
    });
    const info = deriveWinnerInfo(state, nicknames, 1 as PlayerIndex);
    expect(info?.winnerNicknames).toEqual(['Bob']);
    expect(info?.isLocalWinner).toBe(true);
  });

  // The screen used to take the first player found over the target, which is seat order and
  // not the score. With two players across in the same round it named the wrong one.
  it('picks the highest total when several cross in the same round (regression)', () => {
    const state = makeState({
      bidWinner: 2 as PlayerIndex,
      totalScores: new Map<PlayerIndex, number>([
        [0 as PlayerIndex, 1010],
        [1 as PlayerIndex, 430],
        [2 as PlayerIndex, 1180],
      ]),
    });
    const info = deriveWinnerInfo(state, nicknames, 0 as PlayerIndex);
    expect(info?.winnerNicknames).toEqual(['Carol']);
    expect(info?.isLocalWinner).toBe(false);
  });

  // Every score component is a multiple of ten, so exact ties are common.
  it('gives an exact tie to the bid winner, not the lower seat (regression)', () => {
    const state = makeState({
      bidWinner: 2 as PlayerIndex,
      totalScores: new Map<PlayerIndex, number>([
        [0 as PlayerIndex, 1050],
        [1 as PlayerIndex, 300],
        [2 as PlayerIndex, 1050],
      ]),
    });
    const info = deriveWinnerInfo(state, nicknames, 2 as PlayerIndex);
    expect(info?.winnerNicknames).toEqual(['Carol']);
    expect(info?.isLocalWinner).toBe(true);
  });

  it('names both partners in a 4-player game, in seat order', () => {
    const state = makeState({
      playerCount: 4,
      players: [
        player(0, 'Alice', 0),
        player(1, 'Bob', 1),
        player(2, 'Carol', 0),
        player(3, 'Dave', 1),
      ],
      bidWinner: 1 as PlayerIndex,
      totalScores: new Map<Team, number>([
        [0 as Team, 1040],
        [1 as Team, 880],
      ]),
    });
    const info = deriveWinnerInfo(state, nicknames, 3 as PlayerIndex);
    expect(info?.winnerNicknames).toEqual(['Alice', 'Carol']);
    expect(info?.isLocalWinner).toBe(false);
  });

  it('gives a tied team game to the bid winner team (regression)', () => {
    const state = makeState({
      playerCount: 4,
      players: [
        player(0, 'Alice', 0),
        player(1, 'Bob', 1),
        player(2, 'Carol', 0),
        player(3, 'Dave', 1),
      ],
      bidWinner: 1 as PlayerIndex,
      totalScores: new Map<Team, number>([
        [0 as Team, 1100],
        [1 as Team, 1100],
      ]),
    });
    const info = deriveWinnerInfo(state, nicknames, 1 as PlayerIndex);
    expect(info?.winnerNicknames).toEqual(['Bob', 'Dave']);
    expect(info?.isLocalWinner).toBe(true);
  });

  it('returns null when nobody has reached the target', () => {
    const state = makeState({
      totalScores: new Map<PlayerIndex, number>([
        [0 as PlayerIndex, 500],
        [1 as PlayerIndex, 640],
      ]),
    });
    expect(deriveWinnerInfo(state, nicknames, 0 as PlayerIndex)).toBeNull();
  });
});
