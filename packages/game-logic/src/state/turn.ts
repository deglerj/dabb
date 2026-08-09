/**
 * Whose turn it is, per phase.
 */

import type { GameState, PlayerIndex } from '@dabb/shared-types';

/** A bid winner who went out never melds, so they are never owed a melding action. */
function stillOwesMelds(state: GameState, playerIndex: PlayerIndex): boolean {
  if (state.wentOut && playerIndex === state.bidWinner) {
    return false;
  }
  return !state.declaredMelds.has(playerIndex);
}

/**
 * The player the game is currently waiting on, or null if nobody has to act.
 *
 * `state.currentPlayer` alone is not enough: the reducer only sets it from
 * MELDING_COMPLETE onwards, so it is null throughout bidding, dabb, trump and melding.
 * Anything driving automated players (or highlighting whose turn it is) must go through
 * here rather than reading `currentPlayer` directly.
 *
 * In the melding phase this names only the first player who still owes melds, because its
 * job is to drive one automated player at a time. Melding is actually simultaneous — to ask
 * whether a *specific* player is being waited on, use `isWaitingOn`.
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
        if (stillOwesMelds(state, idx)) {
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

/**
 * Whether the game is waiting on this particular player.
 *
 * Differs from `whoActsNext(state) === playerIndex` only during melding, where every player
 * who has not declared yet owes an action at the same time — nothing sequences them, so
 * prompting only the lowest seat would leave the others without a turn indicator.
 */
export function isWaitingOn(state: GameState, playerIndex: PlayerIndex): boolean {
  if (state.phase === 'melding') {
    return stillOwesMelds(state, playerIndex);
  }
  return whoActsNext(state) === playerIndex;
}
