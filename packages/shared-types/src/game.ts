/**
 * Game state types
 */

import type { Card, CardId, Suit } from './cards.js';

export type PlayerCount = 2 | 3 | 4;
export type PlayerIndex = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'bidding'
  | 'dabb'
  | 'trump'
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
  connected: boolean;
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
  | 'vier-unter'
  | 'acht-ass'
  | 'acht-koenig'
  | 'acht-ober'
  | 'acht-unter';

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
  'acht-ass': 1000,
  'acht-koenig': 600,
  'acht-ober': 400,
  'acht-unter': 200,
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
  'acht-ass': 'Acht Asse',
  'acht-koenig': 'Acht Könige',
  'acht-ober': 'Acht Ober',
  'acht-unter': 'Acht Buaben',
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

// Round history for scoreboard
export interface RoundHistoryEntry {
  round: number;
  bidWinner: PlayerIndex | null;
  winningBid: number;
  scores: Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  > | null;
}
