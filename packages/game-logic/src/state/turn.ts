/**
 * Whose turn it is, per phase.
 */

import type { GameState, PlayerIndex } from '@dabb/shared-types';

/**
 * The player the game is currently waiting on, or null if nobody has to act.
 *
 * `state.currentPlayer` alone is not enough: the reducer only sets it from
 * MELDING_COMPLETE onwards, so it is null throughout bidding, dabb, trump and melding.
 * Anything driving automated players (or highlighting whose turn it is) must go through
 * here rather than reading `currentPlayer` directly.
 */
export function whoActsNext(state: GameState): PlayerIndex | null {
  switch (state.phase) {
    case 'bidding':
      return state.currentBidder ?? null;

    case 'dabb':
    case 'trump':
    case 'discard':
      return state.bidWinner ?? null;

    case 'melding': {
      for (let i = 0; i < state.playerCount; i++) {
        const idx = i as PlayerIndex;
        // A bid winner who went out never melds
        if (state.wentOut && idx === state.bidWinner) {
          continue;
        }
        if (!state.declaredMelds.has(idx)) {
          return idx;
        }
      }
      return null;
    }

    case 'tricks':
      return state.currentPlayer ?? null;

    default:
      return null;
  }
}
