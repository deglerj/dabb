/**
 * Bidding logic for Binokel
 */

import {
  BID_INCREMENT,
  MIN_BID,
  PlayerCount,
  PlayerIndex,
} from '@dabb/shared-types';

/**
 * Get the next player in bidding order
 */
export function getNextBidder(
  currentBidder: PlayerIndex,
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>
): PlayerIndex | null {
  // Find next active player
  for (let i = 1; i <= playerCount; i++) {
    const nextIndex = ((currentBidder + i) % playerCount) as PlayerIndex;
    if (!passedPlayers.has(nextIndex)) {
      return nextIndex;
    }
  }
  return null;
}

/**
 * Check if a bid is valid
 */
export function isValidBid(
  amount: number,
  currentBid: number
): boolean {
  if (amount < MIN_BID) return false;
  if (currentBid === 0) return amount >= MIN_BID;
  return amount >= currentBid + BID_INCREMENT;
}

/**
 * Get minimum valid bid amount
 */
export function getMinBid(currentBid: number): number {
  if (currentBid === 0) return MIN_BID;
  return currentBid + BID_INCREMENT;
}

/**
 * Get the first bidder (player after dealer)
 */
export function getFirstBidder(
  dealer: PlayerIndex,
  playerCount: PlayerCount
): PlayerIndex {
  return ((dealer + 1) % playerCount) as PlayerIndex;
}

/**
 * Check if bidding is complete (only one active player left)
 */
export function isBiddingComplete(
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>
): boolean {
  const activePlayers = playerCount - passedPlayers.size;
  return activePlayers <= 1;
}

/**
 * Get the bidding winner
 */
export function getBiddingWinner(
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>
): PlayerIndex | null {
  for (let i = 0; i < playerCount; i++) {
    if (!passedPlayers.has(i as PlayerIndex)) {
      return i as PlayerIndex;
    }
  }
  return null;
}
