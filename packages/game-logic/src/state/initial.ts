/**
 * Initial game state factory
 */

import { GameState, PlayerCount, PlayerIndex } from '@dabb/shared-types';

export function createInitialState(
  playerCount: PlayerCount,
  targetScore: number = 1500
): GameState {
  return {
    phase: 'waiting',
    playerCount,
    players: [],

    // Card state
    hands: new Map(),
    dabb: [],

    // Bidding state
    currentBid: 0,
    bidWinner: null,
    currentBidder: null,
    passedPlayers: new Set(),

    // Trump state
    trump: null,

    // Trick state
    currentTrick: {
      cards: [],
      leadSuit: null,
      winnerIndex: null,
    },
    tricksTaken: new Map(),
    currentPlayer: null,

    // Scoring state
    roundScores: new Map(),
    totalScores: new Map(),
    targetScore,

    // Melds state
    declaredMelds: new Map(),

    // Dealer starts at player 0
    dealer: 0 as PlayerIndex,

    // Round number
    round: 0,
  };
}

/**
 * Reset state for a new round
 */
export function resetForNewRound(state: GameState): GameState {
  return {
    ...state,
    phase: 'dealing',

    // Reset card state
    hands: new Map(),
    dabb: [],

    // Reset bidding state
    currentBid: 0,
    bidWinner: null,
    currentBidder: null,
    passedPlayers: new Set(),

    // Reset trump
    trump: null,

    // Reset trick state
    currentTrick: {
      cards: [],
      leadSuit: null,
      winnerIndex: null,
    },
    tricksTaken: new Map(),
    currentPlayer: null,

    // Reset round scores (keep total scores)
    roundScores: new Map(),
    declaredMelds: new Map(),

    // Rotate dealer
    dealer: ((state.dealer + 1) % state.playerCount) as PlayerIndex,

    // Increment round
    round: state.round + 1,
  };
}
