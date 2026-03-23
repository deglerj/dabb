import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoundHistory } from '../useRoundHistory.js';
import type { GameEvent } from '@dabb/shared-types';

const base = { sessionId: 's1', timestamp: 0 };
const seq = (() => {
  let n = 0;
  return () => ++n;
})();

function ev<T extends GameEvent['type']>(
  type: T,
  payload: Extract<GameEvent, { type: T }>['payload']
): GameEvent {
  return { ...base, id: `e${seq()}`, sequence: seq(), type, payload } as GameEvent;
}

const gameStarted = ev('GAME_STARTED', { playerCount: 3, targetScore: 1000, dealer: 0 });
const biddingWon = ev('BIDDING_WON', { playerIndex: 0, winningBid: 180 });
const goingOut = ev('GOING_OUT', { playerIndex: 0, suit: 'HERZ' });
const roundScored = ev('ROUND_SCORED', {
  scores: {
    0: { melds: 0, tricks: 0, total: -180, bidMet: false },
    1: { melds: 80, tricks: 0, total: 80, bidMet: false },
    2: { melds: 40, tricks: 0, total: 40, bidMet: false },
  },
  totalScores: { 0: -180, 1: 80, 2: 40 },
});
const newRound = ev('NEW_ROUND_STARTED', { round: 2, dealer: 1 });
const biddingWon2 = ev('BIDDING_WON', { playerIndex: 1, winningBid: 160 });
const roundScored2 = ev('ROUND_SCORED', {
  scores: {
    0: { melds: 120, tricks: 90, total: 210, bidMet: false },
    1: { melds: 60, tricks: 100, total: 160, bidMet: true },
    2: { melds: 80, tricks: 30, total: 110, bidMet: false },
  },
  totalScores: { 0: 30, 1: 240, 2: 150 },
});

describe('useRoundHistory', () => {
  it('sets wentOut on a completed going-out round', () => {
    const { result } = renderHook(() =>
      useRoundHistory([gameStarted, biddingWon, goingOut, roundScored])
    );
    expect(result.current.rounds).toHaveLength(1);
    expect(result.current.rounds[0].wentOut).toBe(true);
  });

  it('does not set wentOut on a normal completed round', () => {
    const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon, roundScored]));
    expect(result.current.rounds).toHaveLength(1);
    expect(result.current.rounds[0].wentOut).toBeUndefined();
  });

  it('sets wentOut on currentRound while in progress after going out', () => {
    const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon, goingOut]));
    expect(result.current.currentRound?.wentOut).toBe(true);
  });

  it('does not set wentOut on currentRound before going out', () => {
    const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon]));
    expect(result.current.currentRound?.wentOut).toBeUndefined();
  });

  it('resets wentOut between rounds', () => {
    const { result } = renderHook(() =>
      useRoundHistory([
        gameStarted,
        biddingWon,
        goingOut,
        roundScored,
        newRound,
        biddingWon2,
        roundScored2,
      ])
    );
    expect(result.current.rounds).toHaveLength(2);
    expect(result.current.rounds[0].wentOut).toBe(true);
    expect(result.current.rounds[1].wentOut).toBeUndefined();
  });
});
