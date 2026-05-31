import { describe, it, expect } from 'vitest';
import type { PlayerIndex, GameState, Suit, Rank } from '@dabb/shared-types';
import { BinokelAIPlayer } from '../ai/index.js';

describe('BinokelAIPlayer - 4-player team-aware bidding', () => {
  function makeBiddingState(overrides: Partial<GameState> = {}): GameState {
    const base: GameState = {
      phase: 'bidding',
      playerCount: 4,
      players: [
        { id: 'p0', nickname: 'Alice', playerIndex: 0, team: 0, connected: true },
        { id: 'p1', nickname: 'Bob', playerIndex: 1, team: 1, connected: true },
        { id: 'p2', nickname: 'Carol', playerIndex: 2, team: 0, connected: true },
        { id: 'p3', nickname: 'Dave', playerIndex: 3, team: 1, connected: true },
      ],
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, []],
        [3 as PlayerIndex, []],
      ]),
      dabb: [],
      currentBid: 160,
      bidWinner: null,
      currentBidder: 2 as PlayerIndex,
      firstBidder: 1 as PlayerIndex,
      passedPlayers: new Set(),
      lastBidderIndex: 0 as PlayerIndex, // Alice (team 0) set the current bid
      trump: null,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      tricksTaken: new Map(),
      currentPlayer: null,
      roundScores: new Map(),
      totalScores: new Map(),
      targetScore: 1000,
      declaredMelds: new Map(),
      dealer: 3 as PlayerIndex,
      round: 1,
      wentOut: false,
      dabbCardIds: [],
      lastCompletedTrick: null,
    };
    return { ...base, ...overrides };
  }

  // A weak hand: no melds, few low cards → estimatedTotal well below 160+60
  const weakHand = [
    { id: 'kreuz-buabe-1', suit: 'kreuz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'kreuz-ober-1', suit: 'kreuz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'schippe-buabe-1', suit: 'schippe' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'schippe-ober-1', suit: 'schippe' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'bollen-buabe-1', suit: 'bollen' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'bollen-ober-1', suit: 'bollen' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'bollen-koenig-1', suit: 'bollen' as Suit, rank: 'koenig' as Rank, copy: 0 as const },
  ];

  // A strong hand: Familie in Herz (100 pts melds) + lots of trump → diff well above 60
  const strongHand = [
    { id: 'herz-ass-1', suit: 'herz' as Suit, rank: 'ass' as Rank, copy: 0 as const },
    { id: 'herz-10-1', suit: 'herz' as Suit, rank: '10' as Rank, copy: 0 as const },
    { id: 'herz-koenig-1', suit: 'herz' as Suit, rank: 'koenig' as Rank, copy: 0 as const },
    { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 0 as const },
    { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank, copy: 0 as const },
    { id: 'herz-ass-2', suit: 'herz' as Suit, rank: 'ass' as Rank, copy: 1 as const },
    { id: 'herz-10-2', suit: 'herz' as Suit, rank: '10' as Rank, copy: 1 as const },
    { id: 'herz-koenig-2', suit: 'herz' as Suit, rank: 'koenig' as Rank, copy: 1 as const },
    { id: 'herz-ober-2', suit: 'herz' as Suit, rank: 'ober' as Rank, copy: 1 as const },
  ];

  it('always passes against teammate when hand is weak (diff < 60)', async () => {
    const ai = new BinokelAIPlayer(0); // hard — no blunders
    const state = makeBiddingState({
      currentBid: 160,
      lastBidderIndex: 0 as PlayerIndex, // Alice = team 0 = Carol's teammate
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, weakHand],
        [3 as PlayerIndex, []],
      ]),
    });
    // Hard AI should always pass against teammate when diff < 60 (deterministic)
    for (let i = 0; i < 20; i++) {
      const action = await ai.decide({
        gameState: state,
        playerIndex: 2 as PlayerIndex,
        sessionId: 'test',
      });
      expect(action.type).toBe('pass');
    }
  });

  it('bids against teammate when hand is strong (diff >= 60)', async () => {
    const ai = new BinokelAIPlayer(0);
    const state = makeBiddingState({
      currentBid: 150,
      lastBidderIndex: 0 as PlayerIndex, // teammate
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, strongHand],
        [3 as PlayerIndex, []],
      ]),
    });
    const action = await ai.decide({
      gameState: state,
      playerIndex: 2 as PlayerIndex,
      sessionId: 'test',
    });
    expect(action.type).toBe('bid');
  });

  it('uses normal probabilistic logic when bidding against an opponent', async () => {
    const ai = new BinokelAIPlayer(0);
    const state = makeBiddingState({
      currentBid: 160,
      lastBidderIndex: 1 as PlayerIndex, // Bob = team 1 = opponent
      hands: new Map([
        [0 as PlayerIndex, []],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, weakHand],
        [3 as PlayerIndex, []],
      ]),
    });
    // With a weak hand vs opponent, probabilistic logic applies — just check no crash and valid type
    const action = await ai.decide({
      gameState: state,
      playerIndex: 2 as PlayerIndex,
      sessionId: 'test',
    });
    expect(['bid', 'pass']).toContain(action.type);
  });
});
