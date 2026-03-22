/**
 * Bidding logic for Binokel
 */

import { BID_INCREMENT, MIN_BID, PlayerCount, PlayerIndex } from '@dabb/shared-types';

/**
 * Get the next player in duel-based bidding order.
 *
 * Bidding proceeds as a chain of one-on-one duels:
 *   Duel 1: biddingOrder[0] vs biddingOrder[1]
 *   Duel 2: winner vs biddingOrder[2]
 *   Duel 3: winner vs biddingOrder[3]  (4-player only)
 *
 * @param player - The player who just bid or passed (event.payload.playerIndex)
 * @param playerCount - Total number of players
 * @param passedPlayers - Already updated for pass events; unmodified for bid events
 * @param firstBidder - First player in bidding order (player after dealer); never null during bidding
 */
export function getNextBidder(
  player: PlayerIndex,
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>,
  firstBidder: PlayerIndex
): PlayerIndex | null {
  const biddingOrder = Array.from(
    { length: playerCount },
    (_, i) => ((firstBidder + i) % playerCount) as PlayerIndex
  );

  const justPassed = passedPlayers.has(player);

  if (justPassed) {
    // After a pass: transition to next challenger, or end bidding
    const n = passedPlayers.size;
    if (n + 1 < playerCount) {
      return biddingOrder[n + 1];
    }
    return null;
  } else {
    // After a bid: return the other participant in the current duel
    const challenger = biddingOrder[passedPlayers.size + 1];

    // Survivor: first entry in biddingOrder[0..passedPlayers.size] not in passedPlayers
    let survivor: PlayerIndex | undefined;
    for (let i = 0; i <= passedPlayers.size; i++) {
      if (!passedPlayers.has(biddingOrder[i])) {
        survivor = biddingOrder[i];
        break;
      }
    }

    if (survivor === undefined) {
      return null;
    }

    return player === challenger ? survivor : challenger;
  }
}

/**
 * Check if a bid is valid
 */
export function isValidBid(amount: number, currentBid: number): boolean {
  if (amount < MIN_BID) {
    return false;
  }
  if (currentBid === 0) {
    return amount >= MIN_BID;
  }
  return amount >= currentBid + BID_INCREMENT;
}

/**
 * Get minimum valid bid amount
 */
export function getMinBid(currentBid: number): number {
  if (currentBid === 0) {
    return MIN_BID;
  }
  return currentBid + BID_INCREMENT;
}

/**
 * Get the first bidder (player after dealer)
 */
export function getFirstBidder(dealer: PlayerIndex, playerCount: PlayerCount): PlayerIndex {
  return ((dealer + 1) % playerCount) as PlayerIndex;
}

/**
 * Check if a player can pass
 * The first bidder cannot pass - they must bid at least 150
 */
export function canPass(currentBid: number): boolean {
  return currentBid > 0;
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
