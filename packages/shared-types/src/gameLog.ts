/**
 * Game log types for displaying player actions
 */

import type { Card, Suit } from './cards.js';
import type { Meld, PlayerIndex, Team } from './game.js';

/**
 * Types of log entries that can be displayed
 */
export type GameLogEntryType =
  | 'game_started'
  | 'teams_announced'
  | 'round_started'
  | 'bid_placed'
  | 'player_passed'
  | 'bidding_won'
  | 'dabb_taken'
  | 'going_out'
  | 'trump_declared'
  | 'melds_declared'
  | 'card_played'
  | 'trick_won'
  | 'round_scored'
  | 'game_finished'
  | 'game_terminated';

/**
 * Data for game_started log entry
 */
export interface GameStartedLogData {
  kind: 'game_started';
  playerCount: number;
  targetScore: number;
}

/**
 * Data for teams_announced log entry
 */
export interface TeamsAnnouncedLogData {
  kind: 'teams_announced';
  team0: string[]; // Nicknames of Team 0 members
  team1: string[]; // Nicknames of Team 1 members
}

/**
 * Data for round_started log entry
 */
export interface RoundStartedLogData {
  kind: 'round_started';
  round: number;
}

/**
 * Data for bid_placed log entry
 */
export interface BidPlacedLogData {
  kind: 'bid_placed';
  amount: number;
}

/**
 * Data for player_passed log entry
 */
export interface PlayerPassedLogData {
  kind: 'player_passed';
}

/**
 * Data for bidding_won log entry
 */
export interface BiddingWonLogData {
  kind: 'bidding_won';
  winningBid: number;
}

/**
 * Data for dabb_taken log entry
 */
export interface DabbTakenLogData {
  kind: 'dabb_taken';
  cards: Card[];
}

/**
 * Data for going_out log entry
 */
export interface GoingOutLogData {
  kind: 'going_out';
  suit: Suit;
}

/**
 * Data for trump_declared log entry
 */
export interface TrumpDeclaredLogData {
  kind: 'trump_declared';
  suit: Suit;
}

/**
 * Data for melds_declared log entry
 */
export interface MeldsDeclaredLogData {
  kind: 'melds_declared';
  melds: Meld[];
  totalPoints: number;
}

/**
 * Data for card_played log entry
 */
export interface CardPlayedLogData {
  kind: 'card_played';
  card: Card;
}

/**
 * Data for trick_won log entry
 */
export interface TrickWonLogData {
  kind: 'trick_won';
  points: number;
}

/**
 * Data for round_scored log entry
 */
export interface RoundScoredLogData {
  kind: 'round_scored';
  scores: Record<
    PlayerIndex | Team,
    {
      melds: number;
      tricks: number;
      total: number;
      bidMet: boolean;
    }
  >;
}

/**
 * Data for game_finished log entry
 */
export interface GameFinishedLogData {
  kind: 'game_finished';
  winner: PlayerIndex | Team;
}

/**
 * Data for game_terminated log entry
 */
export interface GameTerminatedLogData {
  kind: 'game_terminated';
  reason: 'player_exit';
}

/**
 * Discriminated union of all log entry data types
 */
export type GameLogEntryData =
  | GameStartedLogData
  | TeamsAnnouncedLogData
  | RoundStartedLogData
  | BidPlacedLogData
  | PlayerPassedLogData
  | BiddingWonLogData
  | DabbTakenLogData
  | GoingOutLogData
  | TrumpDeclaredLogData
  | MeldsDeclaredLogData
  | CardPlayedLogData
  | TrickWonLogData
  | RoundScoredLogData
  | GameFinishedLogData
  | GameTerminatedLogData;

/**
 * A single game log entry
 */
export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: GameLogEntryType;
  playerIndex: PlayerIndex | null;
  data: GameLogEntryData;
}
