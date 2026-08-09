/**
 * Regression tests for 4-player (team) round scoring.
 *
 * All of these failed before: team lookups read a `PlayerInfo[]` sourced from Firebase
 * session meta, which has no team field, so `getTeamPlayerIndices` returned [] and every
 * team scored 0 — the bid was never enforced and no game could ever finish. Going out
 * additionally threw a TypeError (`scores[undefined]` / `scores[NaN]`), which left the
 * round stranded in the trick phase.
 */
import { describe, it, expect } from 'vitest';
import {
  applyEvents,
  calculateMeldPoints,
  calculatePlayerTrickRawPoints,
  getValidPlays,
} from '../index.js';
import type { GameEvent, GameState, PlayerIndex, Team } from '@dabb/shared-types';
import {
  createStartGameEvents,
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createGoOutEvents,
  createPlayCardEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
} from '../engine/index.js';
import type { NextContext, PlayerInfo } from '../engine/index.js';

const SESSION = 'test-session';

const makeNext = (start = 0): NextContext => {
  let n = start;
  return () => ({ sessionId: SESSION, sequence: ++n });
};

const PLAYERS_4: PlayerInfo[] = [
  { playerIndex: 0, nickname: 'Alice', isAI: false, team: null },
  { playerIndex: 1, nickname: 'Bob', isAI: false, team: null },
  { playerIndex: 2, nickname: 'Charlie', isAI: false, team: null },
  { playerIndex: 3, nickname: 'Dora', isAI: false, team: null },
];

/** Accumulates events and keeps a replayed state in sync. */
class Round {
  events: GameEvent[] = [];
  state: GameState;
  private n = 0;
  private readonly next: NextContext = () => ({ sessionId: SESSION, sequence: ++this.n });

  constructor() {
    this.push(createStartGameEvents(this.next, PLAYERS_4, 4, 1000));
    this.state = applyEvents(this.events);
  }

  push(evts: GameEvent[]): void {
    this.events = [...this.events, ...evts];
    this.state = applyEvents(this.events);
  }

  act(fn: (state: GameState, next: NextContext) => GameEvent[]): void {
    this.push(fn(this.state, this.next));
  }

  /** Bidding: dealer is 3, so player 0 opens; everyone else passes. */
  bidWonByPlayer0(bid: number): void {
    this.act((s, next) => createBidPlacedEvents(s, 0, bid, next));
    for (const p of [1, 2, 3] as PlayerIndex[]) {
      this.act((s, next) => createPlayerPassedEvents(s, p, next));
    }
  }

  takeDabb(): void {
    this.act((s, next) => createTakeDabbEvents(s, 0, next));
  }

  /** Trump first, then the layaway — see GamePhase in shared-types. */
  declareTrumpAndDiscard(): void {
    this.act((s, next) => createDeclareTrumpEvents(s, 0, (s.hands.get(0) ?? [])[0].suit, next));
    this.act((s, next) =>
      createDiscardCardsEvents(
        s,
        0,
        (s.hands.get(0) ?? []).slice(0, 4).map((c) => c.id),
        next
      )
    );
  }

  declareAllMelds(): void {
    for (const p of [0, 1, 2, 3] as PlayerIndex[]) {
      if (this.state.phase !== 'melding' || this.state.declaredMelds.has(p)) {
        continue;
      }
      if (this.state.wentOut && this.state.bidWinner === p) {
        continue;
      }
      this.act((s, next) => createDeclareMeldsEvents(s, p, next));
    }
  }

  playAllTricks(): void {
    let guard = 0;
    while (this.state.phase === 'tricks' && guard++ < 100) {
      const p = this.state.currentPlayer!;
      const hand = this.state.hands.get(p) ?? [];
      const card = getValidPlays(hand, this.state.currentTrick, this.state.trump!)[0];
      this.act((s, next) => createPlayCardEvents(s, p, card.id, next));
    }
  }

  private get scoredIndex(): number {
    const i = this.events.findIndex((e) => e.type === 'ROUND_SCORED');
    if (i === -1) {
      throw new Error('no ROUND_SCORED event was emitted');
    }
    return i;
  }

  get roundScored() {
    const evt = this.events[this.scoredIndex];
    if (evt.type !== 'ROUND_SCORED') {
      throw new Error('unreachable');
    }
    return evt.payload;
  }

  /**
   * State as of the moment the round was scored. `this.state` is past the
   * NEW_ROUND_STARTED + CARDS_DEALT that immediately follow, which reset everything.
   */
  get scoredState(): GameState {
    return applyEvents(this.events.slice(0, this.scoredIndex));
  }
}

describe('4-player team assignment', () => {
  it('pairs players sitting opposite each other (seat parity)', () => {
    const state = applyEvents(createStartGameEvents(makeNext(), PLAYERS_4, 4, 1000));
    const teamOf = (i: PlayerIndex) => state.players.find((p) => p.playerIndex === i)?.team;
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
  });

  it('leaves teams unset for 3-player games', () => {
    const state = applyEvents(createStartGameEvents(makeNext(), PLAYERS_4.slice(0, 3), 3, 1000));
    expect(state.players.every((p) => p.team === undefined)).toBe(true);
  });
});

describe('4-player round scoring', () => {
  function playedOutRound(): Round {
    const round = new Round();
    round.bidWonByPlayer0(150);
    round.takeDabb();
    round.declareTrumpAndDiscard();
    round.declareAllMelds();
    round.playAllTricks();
    return round;
  }

  it('scores per team, not all zeros (regression)', () => {
    const { scores, totalScores } = playedOutRound().roundScored;

    expect(Object.keys(scores).sort()).toEqual(['0', '1']);
    expect(Object.keys(totalScores).sort()).toEqual(['0', '1']);
    // The whole deck is worth 240 + 10 for the last trick, so both teams cannot be empty.
    expect(scores[0].tricks + scores[1].tricks).toBeGreaterThan(0);
  });

  it('counts the bid winner’s discarded dabb cards as team trick points (regression)', () => {
    const state = playedOutRound().scoredState;
    const lastTrickWinner = state.lastCompletedTrick?.winnerIndex ?? null;

    const rawTotal = ([0, 1, 2, 3] as PlayerIndex[]).reduce<number>(
      (sum, idx) => sum + calculatePlayerTrickRawPoints(idx, state.tricksTaken, lastTrickWinner),
      0
    );
    // 240 card points across the full 40-card deck (the 4 discards included) + 10 last trick
    expect(rawTotal).toBe(250);
  });

  it('rounds each team’s trick total once, not per player (regression)', () => {
    const round = playedOutRound();
    const { scores } = round.roundScored;
    const state = round.scoredState;
    const lastTrickWinner = state.lastCompletedTrick?.winnerIndex ?? null;

    for (const team of [0, 1] as Team[]) {
      const indices = state.players.filter((p) => p.team === team).map((p) => p.playerIndex);
      const teamRaw = indices.reduce<number>(
        (sum, idx) => sum + calculatePlayerTrickRawPoints(idx, state.tricksTaken, lastTrickWinner),
        0
      );
      expect(scores[team].tricks).toBe(Math.round(teamRaw / 10) * 10);
    }
  });

  it('sums both partners’ melds into the team score', () => {
    const round = playedOutRound();
    const { scores } = round.roundScored;
    const state = round.scoredState;

    for (const team of [0, 1] as Team[]) {
      const indices = state.players.filter((p) => p.team === team).map((p) => p.playerIndex);
      const expected = indices.reduce<number>(
        (sum, idx) => sum + calculateMeldPoints(state.declaredMelds.get(idx) ?? []),
        0
      );
      expect(scores[team].melds).toBe(expected);
    }
  });

  it('penalises the bid winner’s whole team when the bid is missed', () => {
    const round = new Round();
    round.bidWonByPlayer0(400); // unreachable for one team in a single round
    round.takeDabb();
    round.declareTrumpAndDiscard();
    round.declareAllMelds();
    round.playAllTricks();

    const { scores } = round.roundScored;
    const bidWinnerTeam = 0 as Team; // player 0, seat parity
    if (scores[bidWinnerTeam].melds + scores[bidWinnerTeam].tricks < 400) {
      expect(scores[bidWinnerTeam].bidMet).toBe(false);
      expect(scores[bidWinnerTeam].total).toBe(-800);
    }
    expect(scores[1].bidMet).toBe(true);
  });
});

describe('4-player going out', () => {
  function goneOutRound(): Round {
    const round = new Round();
    round.bidWonByPlayer0(150);
    round.takeDabb();
    round.act((s, next) => createDeclareTrumpEvents(s, 0, (s.hands.get(0) ?? [])[0].suit, next));
    round.act((s, next) => createGoOutEvents(s, 0, next));
    round.declareAllMelds();
    return round;
  }

  it('ends the round instead of falling through to the trick phase (regression)', () => {
    const round = goneOutRound();
    // Round is scored straight out of melding — no cards are ever played
    expect(round.events.some((e) => e.type === 'CARD_PLAYED')).toBe(false);
    expect(round.events.some((e) => e.type === 'ROUND_SCORED')).toBe(true);
    // ...and the next round is dealt, rather than the game stalling in 'tricks'
    expect(round.state.phase).toBe('bidding');
    expect(round.state.round).toBe(2);
  });

  it('charges the bid to the bid winner’s team and pays melds + 40 to the opponents', () => {
    const round = goneOutRound();
    const { scores } = round.roundScored;
    const scoredState = round.scoredState;

    expect(Object.keys(scores).sort()).toEqual(['0', '1']);
    expect(scores[0]).toEqual({ melds: 0, tricks: 0, total: -150, bidMet: false });

    const opponentMelds = ([1, 3] as PlayerIndex[]).reduce<number>(
      (sum, idx) => sum + calculateMeldPoints(scoredState.declaredMelds.get(idx) ?? []),
      0
    );
    expect(scores[1]).toEqual({
      melds: opponentMelds,
      tricks: 0,
      total: opponentMelds + 40,
      bidMet: true,
    });
  });

  it('does not require the bid winner to meld', () => {
    const round = goneOutRound();
    const scoredState = round.scoredState;
    expect(scoredState.declaredMelds.has(0)).toBe(false);
    expect(scoredState.declaredMelds.size).toBe(3);
  });
});
