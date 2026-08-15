import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCelebration } from '../useCelebration.js';
import type { GameEvent } from '@dabb/shared-types';

const baseEvent = {
  sessionId: 'session-1',
  timestamp: Date.now(),
};

/** Nothing was in the log when this client joined — every event is live. */
const NO_REPLAY = new Set<string>();

let seq = 0;
function makeEvent(overrides: Partial<GameEvent> & { type: GameEvent['type'] }): GameEvent {
  return { ...baseEvent, id: `e${++seq}`, sequence: seq, ...overrides } as GameEvent;
}

const gameStarted = makeEvent({
  type: 'GAME_STARTED',
  payload: { playerCount: 3, targetScore: 1000, dealer: 0 },
});

function biddingWon(playerIndex: 0 | 1 | 2 = 0) {
  return makeEvent({
    type: 'BIDDING_WON',
    payload: { playerIndex, winningBid: 150 },
  });
}

/** Mirrors real scoring: only the bid winner's entry carries a meaningful bidMet. */
function roundScored(bidMet: boolean, bidWinner: 0 | 1 | 2 = 0) {
  const score = (i: number) => ({
    melds: 20,
    tricks: 150,
    total: 170,
    bidMet: i === bidWinner ? bidMet : true,
  });
  return makeEvent({
    type: 'ROUND_SCORED',
    payload: {
      scores: { 0: score(0), 1: score(1), 2: score(2), 3: score(3) },
      totalScores: { 0: 170, 1: 0, 2: 0, 3: 0 },
    },
  });
}

function newRoundStarted(round: number) {
  return makeEvent({
    type: 'NEW_ROUND_STARTED',
    payload: { round, dealer: 1 },
  });
}

describe('useCelebration', () => {
  it('returns no outcome when no rounds have been scored', () => {
    const { result } = renderHook(() => useCelebration([gameStarted], 0, NO_REPLAY));
    expect(result.current.roundOutcome).toBeNull();
    expect(result.current.showFireworks).toBe(false);
  });

  it('reports a local win in round 1', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(true)];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome).toEqual({
      round: 1,
      bidMet: true,
      isLocalSide: true,
      bidWinner: 0,
    });
  });

  it('reports another player winning their bid', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(1), roundScored(true, 1)];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome).toEqual({
      round: 1,
      bidMet: true,
      isLocalSide: false,
      bidWinner: 1,
    });
  });

  it('reports another player missing their bid', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(1), roundScored(false, 1)];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome).toEqual({
      round: 1,
      bidMet: false,
      isLocalSide: false,
      bidWinner: 1,
    });
  });

  it('reports the local player missing their own bid', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(false)];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome).toEqual({
      round: 1,
      bidMet: false,
      isLocalSide: true,
      bidWinner: 0,
    });
  });

  it('reads bidMet off the bid winner, not the local player (regression)', () => {
    // Everyone but the bid winner is scored with bidMet: true, so reading the local
    // player's entry announced a win for a round the bid winner actually missed.
    const events: GameEvent[] = [gameStarted, biddingWon(1), roundScored(false, 1)];
    const { result } = renderHook(() => useCelebration(events, 2, NO_REPLAY));
    expect(result.current.roundOutcome?.bidMet).toBe(false);
  });

  it('bumps the round on consecutive wins (regression: was stuck at boolean true→true)', () => {
    // Bug: showConfetti was boolean; winning round 2 after round 1 kept it true→true,
    // so the useEffect in CelebrationLayer never re-fired for the second win.
    const events: GameEvent[] = [
      gameStarted,
      biddingWon(0),
      roundScored(true), // round 1 win
      newRoundStarted(2),
      biddingWon(0),
      roundScored(true), // round 2 win → round should become 2 (not stay at 1)
    ];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome?.round).toBe(2);
  });

  it('replaces a round 1 win with the round 2 outcome', () => {
    const events: GameEvent[] = [
      gameStarted,
      biddingWon(0),
      roundScored(true),
      newRoundStarted(2),
      biddingWon(1),
      roundScored(false, 1),
    ];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.roundOutcome).toEqual({
      round: 2,
      bidMet: false,
      isLocalSide: false,
      bidWinner: 1,
    });
  });

  it('scores a 4-player round against the bid winner’s team', () => {
    // Seats 0/2 are team 0, seats 1/3 team 1; the bid winner sits on team 1 and misses.
    const joins = ([0, 1, 2, 3] as const).map((playerIndex) =>
      makeEvent({
        type: 'PLAYER_JOINED',
        payload: {
          playerId: `p${playerIndex}`,
          playerIndex,
          nickname: `P${playerIndex}`,
          team: (playerIndex % 2) as 0 | 1,
        },
      })
    );
    const events: GameEvent[] = [...joins, gameStarted, biddingWon(1), roundScored(false, 1)];

    const { result: onBidTeam } = renderHook(() => useCelebration(events, 3, NO_REPLAY));
    expect(onBidTeam.current.roundOutcome).toEqual({
      round: 1,
      bidMet: false,
      isLocalSide: true,
      bidWinner: 1,
    });

    const { result: opponent } = renderHook(() => useCelebration(events, 2, NO_REPLAY));
    expect(opponent.current.roundOutcome?.isLocalSide).toBe(false);
    expect(opponent.current.roundOutcome?.bidMet).toBe(false);
  });

  it('returns showFireworks when current player wins the game', () => {
    const gameFinished = makeEvent({
      type: 'GAME_FINISHED',
      payload: { winner: 0, finalScores: { 0: 1050, 1: 200, 2: 300, 3: 0 } },
    });
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(true), gameFinished];
    const { result } = renderHook(() => useCelebration(events, 0, NO_REPLAY));
    expect(result.current.showFireworks).toBe(true);
    expect(result.current.roundOutcome).toBeNull(); // round announcement cleared when game ends
  });

  it('stays quiet for a round scored before we joined (regression)', () => {
    // Rejoining replays the whole log; announcing a round that ended without us — and firing
    // the confetti for it — used to happen on every reconnect.
    const gameFinished = makeEvent({
      type: 'GAME_FINISHED',
      payload: { winner: 0, finalScores: { 0: 1050, 1: 200, 2: 300, 3: 0 } },
    });
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(true), gameFinished];
    const replayed = new Set(events.map((e) => e.id));
    const { result } = renderHook(() => useCelebration(events, 0, replayed));
    expect(result.current.roundOutcome).toBeNull();
    expect(result.current.showFireworks).toBe(false);
  });

  it('returns no outcome for null playerIndex', () => {
    const { result } = renderHook(() => useCelebration([gameStarted], null, NO_REPLAY));
    expect(result.current.roundOutcome).toBeNull();
    expect(result.current.showFireworks).toBe(false);
  });
});
