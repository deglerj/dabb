/**
 * Game state types
 */

import type { Card, CardId, Suit } from './cards.js';

export type PlayerCount = 2 | 3 | 4;
export type PlayerIndex = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

/**
 * Phase order for the bid winner is: `dabb` (take it) → `trump` (declare it) → `discard`
 * (lay four away). Trump comes first so that burying a trump card is a real decision the
 * player has to announce — see `filterCardsDiscarded` in game-logic/state/views.ts.
 */
export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'bidding'
  | 'dabb'
  | 'trump'
  | 'discard'
  | 'melding'
  | 'tricks'
  | 'scoring'
  | 'finished'
  | 'terminated';

export interface Player {
  id: string;
  nickname: string;
  playerIndex: PlayerIndex;
  team?: Team; // Only for 4-player games
}

export interface PlayedCard {
  cardId: CardId;
  card: Card;
  playerIndex: PlayerIndex;
}

export interface Trick {
  cards: PlayedCard[];
  leadSuit: Suit | null;
  winnerIndex: PlayerIndex | null;
}

export interface CompletedTrick {
  cards: PlayedCard[];
  winnerIndex: PlayerIndex;
  points: number;
  /**
   * Round the trick was played in. It survives into the next round (the trick animation needs
   * it — see resetForNewRound), so anything that reasons about the *current* round must check.
   */
  round: number;
}

export interface RoundScore {
  melds: number;
  tricks: number;
  total: number;
}

export interface GameState {
  phase: GamePhase;
  playerCount: PlayerCount;
  players: Player[];

  // Card state
  hands: Map<PlayerIndex, Card[]>;
  dabb: Card[];

  // Bidding state
  currentBid: number;
  bidWinner: PlayerIndex | null;
  currentBidder: PlayerIndex | null;
  firstBidder: PlayerIndex | null; // Player who starts each round (plays first card in tricks)
  passedPlayers: Set<PlayerIndex>;
  lastBidderIndex: PlayerIndex | null; // Player who last placed a bid (null at round start)

  // Trump state
  trump: Suit | null;

  // Trick state
  currentTrick: Trick;
  tricksTaken: Map<PlayerIndex, Card[][]>; // Cards won in tricks
  currentPlayer: PlayerIndex | null;

  // Scoring state
  roundScores: Map<PlayerIndex | Team, RoundScore>;
  totalScores: Map<PlayerIndex | Team, number>;
  targetScore: number;

  // Melds state
  declaredMelds: Map<PlayerIndex, Meld[]>;

  // Dealer rotates each round
  dealer: PlayerIndex;

  // Round number
  round: number;

  // Whether bid winner chose to "go out" (forfeit round)
  wentOut: boolean;

  // IDs of cards that came from the dabb (for highlighting)
  dabbCardIds: CardId[];

  // Last completed trick (for display pause)
  lastCompletedTrick: CompletedTrick | null;

  /**
   * Every trick completed in the **current** round, in play order.
   *
   * `tricksTaken` is keyed by winner and so loses who played which card — the AI's card
   * counting needs the play order to deduce voids from the follow/beat/trump obligations.
   * Unlike `lastCompletedTrick`, this is cleared on a new round: a deduction carried across
   * rounds would be made against a dead hand and a dead trump.
   */
  trickHistory: CompletedTrick[];
}

// Meld types
export type MeldType =
  | 'paar'
  | 'familie'
  | 'binokel'
  | 'doppel-binokel'
  | 'vier-ass'
  | 'vier-koenig'
  | 'vier-ober'
  | 'vier-unter';

export interface Meld {
  type: MeldType;
  cards: CardId[];
  points: number;
  suit?: Suit; // For suit-specific melds like Paar or Familie
}

// Default meld values (can be configured)
export const MELD_BASE_POINTS: Record<MeldType, number> = {
  paar: 20,
  familie: 100,
  binokel: 40,
  'doppel-binokel': 300,
  'vier-ass': 100,
  'vier-koenig': 80,
  'vier-ober': 60,
  'vier-unter': 40,
};

// Meld display names (Swabian German - used in all languages)
export const MELD_NAMES: Record<MeldType, string> = {
  paar: 'Paar',
  familie: 'Familie',
  binokel: 'Binokel',
  'doppel-binokel': 'Doppel-Binokel',
  'vier-ass': 'Vier Asse',
  'vier-koenig': 'Vier Könige',
  'vier-ober': 'Vier Ober',
  'vier-unter': 'Vier Buaben',
};

// Melds that require a suit prefix in their display name
const SUIT_SPECIFIC_MELDS: MeldType[] = ['paar', 'familie'];

/**
 * Format a meld for display.
 * For suit-specific melds (Paar, Familie), includes the suit name as prefix.
 */
export function formatMeldName(meld: Meld, suitNames: Record<string, string>): string {
  const baseName = MELD_NAMES[meld.type];
  if (SUIT_SPECIFIC_MELDS.includes(meld.type) && meld.suit) {
    const suitName = suitNames[meld.suit] || meld.suit;
    return `${suitName}-${baseName}`;
  }
  return baseName;
}

// Trump bonus for certain melds
export const MELD_TRUMP_BONUS: Partial<Record<MeldType, number>> = {
  paar: 20, // 20 -> 40 in trump
  familie: 50, // 100 -> 150 in trump
};

// Cards per player based on player count (40-card deck)
export const CARDS_PER_PLAYER: Record<PlayerCount, number> = {
  2: 18,
  3: 12,
  4: 9,
};

export const DABB_SIZE: Record<PlayerCount, number> = {
  2: 4,
  3: 4,
  4: 4,
};

// Bidding constants
export const MIN_BID = 150;
export const BID_INCREMENT = 10;

/**
 * How long one player's melds are laid out on the table after melding completes, arc-in and
 * retraction included (see useMeldShowcase in ui-shared).
 *
 * Lives here because both AI drivers — useAI online, OfflineGameEngine offline — have to hold
 * the first trick card back for the length of the whole showcase, and neither may depend on
 * a UI package.
 */
export const MELD_SHOWCASE_DURATION_MS = 3750;

/** Used by ScoreboardStrip and ScoreboardModal in 4-player team games */
export interface TeamScoreEntry {
  team: Team;
  names: string; // e.g. "Anna & Bob" — pre-formatted by caller
  /** Seats on this team, ascending. Callers that mark individual players need them apart. */
  members: PlayerIndex[];
  score: number;
  isMyTeam: boolean;
}

/**
 * What one player (2/3-player) or one team (4-player) scored in a single round.
 *
 * `total` is not always `melds + tricks`: a bid winner who missed their bid forfeits both
 * and takes `-2 × winningBid` instead, and going out replaces the round with `-1 × bid`
 * for the bid winner and melds plus a bonus for everyone else.
 */
export interface RoundScoreEntry {
  melds: number;
  tricks: number;
  total: number;
  bidMet: boolean;
}

/** Per-round scores keyed by player index (2/3-player) or by team (4-player). */
export type RoundScores = Record<PlayerIndex | Team, RoundScoreEntry>;

// Round history for scoreboard
export interface RoundHistoryEntry {
  round: number;
  bidWinner: PlayerIndex | null;
  winningBid: number;
  wentOut?: boolean; // true when the bid winner chose to go out (Abgehen)
  scores: RoundScores | null;
}
