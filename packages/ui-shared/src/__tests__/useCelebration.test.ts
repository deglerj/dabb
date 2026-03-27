import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCelebration } from '../useCelebration.js';
import type { GameEvent } from '@dabb/shared-types';

const baseEvent = {
  sessionId: 'session-1',
  timestamp: Date.now(),
};

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

function roundScored(bidMet: boolean) {
  return makeEvent({
    type: 'ROUND_SCORED',
    payload: {
      scores: {
        0: { melds: 20, tricks: 150, total: 170, bidMet },
        1: { melds: 0, tricks: 0, total: 0, bidMet: false },
        2: { melds: 0, tricks: 0, total: 0, bidMet: false },
        3: { melds: 0, tricks: 0, total: 0, bidMet: false },
      },
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
  it('returns confettiRound = 0 when no rounds have been scored', () => {
    const { result } = renderHook(() => useCelebration([gameStarted], 0));
    expect(result.current.confettiRound).toBe(0);
    expect(result.current.showFireworks).toBe(false);
  });

  it('returns confettiRound = 1 after winning round 1', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(true)];
    const { result } = renderHook(() => useCelebration(events, 0));
    expect(result.current.confettiRound).toBe(1);
  });

  it('returns confettiRound = 0 after losing round 1', () => {
    const events: GameEvent[] = [gameStarted, biddingWon(1), roundScored(false)];
    const { result } = renderHook(() => useCelebration(events, 0));
    expect(result.current.confettiRound).toBe(0);
  });

  it('returns confettiRound = 2 after winning consecutive rounds (regression: was stuck at boolean true→true)', () => {
    // Bug: showConfetti was boolean; winning round 2 after round 1 kept it true→true,
    // so the useEffect in CelebrationLayer never re-fired for the second win.
    const events: GameEvent[] = [
      gameStarted,
      biddingWon(0),
      roundScored(true), // round 1 win → confettiRound should become 1
      newRoundStarted(2),
      biddingWon(0),
      roundScored(true), // round 2 win → confettiRound should become 2 (not stay at 1)
    ];
    const { result } = renderHook(() => useCelebration(events, 0));
    expect(result.current.confettiRound).toBe(2);
  });

  it('returns confettiRound = 0 after losing round 2 following a round 1 win', () => {
    const events: GameEvent[] = [
      gameStarted,
      biddingWon(0),
      roundScored(true),
      newRoundStarted(2),
      biddingWon(1),
      roundScored(false),
    ];
    const { result } = renderHook(() => useCelebration(events, 0));
    expect(result.current.confettiRound).toBe(0);
  });

  it('returns showFireworks when current player wins the game', () => {
    const gameFinished = makeEvent({
      type: 'GAME_FINISHED',
      payload: { winner: 0, finalScores: { 0: 1050, 1: 200, 2: 300, 3: 0 } },
    });
    const events: GameEvent[] = [gameStarted, biddingWon(0), roundScored(true), gameFinished];
    const { result } = renderHook(() => useCelebration(events, 0));
    expect(result.current.showFireworks).toBe(true);
    expect(result.current.confettiRound).toBe(0); // confetti cleared when game ends
  });

  it('returns confettiRound = 0 for null playerIndex', () => {
    const { result } = renderHook(() => useCelebration([gameStarted], null));
    expect(result.current.confettiRound).toBe(0);
    expect(result.current.showFireworks).toBe(false);
  });
});
