/**
 * Reusable test utilities for game-logic integration tests
 */

import type { Card, GameEvent, GameState, Meld, PlayerIndex, Suit, Rank } from '@dabb/shared-types';

import { applyEvents } from '../state/reducer.js';
import { detectMelds, calculateMeldPoints } from '../melds/detector.js';
import { determineTrickWinner, calculateTrickPoints } from '../phases/tricks.js';
import {
  createPlayerJoinedEvent,
  createGameStartedEvent,
  createCardsDealtEvent,
  createBidPlacedEvent,
  createPlayerPassedEvent,
  createBiddingWonEvent,
  createDabbTakenEvent,
  createCardsDiscardedEvent,
  createGoingOutEvent,
  createTrumpDeclaredEvent,
  createMeldsDeclaredEvent,
  createMeldingCompleteEvent,
  createCardPlayedEvent,
  createTrickWonEvent,
  createRoundScoredEvent,
  createNewRoundStartedEvent,
  createGameTerminatedEvent,
} from '../events/generators.js';

/**
 * Create a card with specific properties for deterministic testing
 */
export function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return {
    id: `${suit}-${rank}-${copy}`,
    suit,
    rank,
    copy,
  };
}

/**
 * Create a hand from an array of card specs
 */
export function createHand(specs: Array<[Suit, Rank, 0 | 1]>): Card[] {
  return specs.map(([suit, rank, copy]) => card(suit, rank, copy));
}

/**
 * Player action interface for fluent API
 */
interface PlayerActions {
  joins(): void;
  bids(amount: number): void;
  passes(): void;
  takesDabb(): void;
  discards(cards: Card[]): void;
  goesOut(suit: Suit): void;
  declaresTrump(suit: Suit): void;
  declaresMelds(melds: Meld[]): void;
  plays(playedCard: Card): void;
}

/**
 * Test helper class for managing game state through events
 */
export class GameTestHelper {
  private events: GameEvent[] = [];
  private sequence = 0;
  private sessionId: string;

  // Named players for 2-player games
  public alice: PlayerActions;
  public bob: PlayerActions;

  // Stored for later phases
  private storedDabb: Card[] = [];

  private constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.alice = this.createPlayerActions(0 as PlayerIndex, 'Alice');
    this.bob = this.createPlayerActions(1 as PlayerIndex, 'Bob');
  }

  static create(sessionId: string): GameTestHelper {
    return new GameTestHelper(sessionId);
  }

  private ctx() {
    return { sessionId: this.sessionId, sequence: ++this.sequence };
  }

  private createPlayerActions(playerIndex: PlayerIndex, nickname: string): PlayerActions {
    return {
      joins: () => {
        this.events.push(
          createPlayerJoinedEvent(this.ctx(), `player-${playerIndex}`, playerIndex, nickname)
        );
      },

      bids: (amount: number) => {
        this.events.push(createBidPlacedEvent(this.ctx(), playerIndex, amount));
      },

      passes: () => {
        this.events.push(createPlayerPassedEvent(this.ctx(), playerIndex));

        // Check if bidding is now complete (all but one passed)
        const state = this.state;
        if (state.passedPlayers.size === state.playerCount - 1) {
          // Find the winner (the one who hasn't passed)
          let winner: PlayerIndex | null = null;
          for (let i = 0; i < state.playerCount; i++) {
            if (!state.passedPlayers.has(i as PlayerIndex)) {
              winner = i as PlayerIndex;
              break;
            }
          }
          if (winner !== null) {
            this.events.push(createBiddingWonEvent(this.ctx(), winner, state.currentBid));
          }
        }
      },

      takesDabb: () => {
        this.events.push(createDabbTakenEvent(this.ctx(), playerIndex, this.storedDabb));
      },

      discards: (cards: Card[]) => {
        this.events.push(
          createCardsDiscardedEvent(
            this.ctx(),
            playerIndex,
            cards.map((c) => c.id)
          )
        );
      },

      goesOut: (suit: Suit) => {
        this.events.push(createGoingOutEvent(this.ctx(), playerIndex, suit));
      },

      declaresTrump: (suit: Suit) => {
        this.events.push(createTrumpDeclaredEvent(this.ctx(), playerIndex, suit));
      },

      declaresMelds: (melds: Meld[]) => {
        const totalPoints = calculateMeldPoints(melds);
        this.events.push(createMeldsDeclaredEvent(this.ctx(), playerIndex, melds, totalPoints));
      },

      plays: (playedCard: Card) => {
        this.events.push(createCardPlayedEvent(this.ctx(), playerIndex, playedCard));

        // Check if trick is complete
        const state = this.state;
        if (state.currentTrick.cards.length === state.playerCount) {
          // Determine winner
          const winnerIdx = determineTrickWinner(state.currentTrick, state.trump!);
          const winnerPlayerIndex = state.currentTrick.cards[winnerIdx].playerIndex;
          const trickCards = state.currentTrick.cards.map((pc) => pc.card);
          const points = calculateTrickPoints(trickCards);

          this.events.push(createTrickWonEvent(this.ctx(), winnerPlayerIndex, trickCards, points));
        }
      },
    };
  }

  /**
   * Start the game with specified configuration
   */
  startGame(config: { playerCount: 2 | 3 | 4; targetScore: number; dealer: PlayerIndex }): void {
    this.events.push(
      createGameStartedEvent(this.ctx(), config.playerCount, config.targetScore, config.dealer)
    );
  }

  /**
   * Deal predetermined cards for deterministic testing
   */
  dealCards(config: { alice: Card[]; bob: Card[]; dabb: Card[] }): void {
    const hands: Record<PlayerIndex, Card[]> = {
      0: config.alice,
      1: config.bob,
      2: [],
      3: [],
    };

    // Store dabb for later use in takesDabb
    this.storedDabb = config.dabb;

    this.events.push(createCardsDealtEvent(this.ctx(), hands, config.dabb));
  }

  /**
   * Mark melding phase as complete
   */
  completeMelding(): void {
    const state = this.state;
    const meldScores: Record<PlayerIndex, number> = {} as Record<PlayerIndex, number>;

    for (let i = 0; i < state.playerCount; i++) {
      const playerMelds = state.declaredMelds.get(i as PlayerIndex) || [];
      meldScores[i as PlayerIndex] = calculateMeldPoints(playerMelds);
    }

    this.events.push(createMeldingCompleteEvent(this.ctx(), meldScores));
  }

  /**
   * Score the round and optionally start a new one
   */
  scoreRound(config: {
    scores: Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>;
    totalScores: Record<PlayerIndex, number>;
  }): void {
    this.events.push(createRoundScoredEvent(this.ctx(), config.scores, config.totalScores));
  }

  /**
   * Start a new round
   */
  startNewRound(config: { round: number; dealer: PlayerIndex }): void {
    this.events.push(createNewRoundStartedEvent(this.ctx(), config.round, config.dealer));
  }

  /**
   * Get current game state by applying all events
   */
  get state(): GameState {
    return applyEvents(this.events);
  }

  /**
   * Get all events
   */
  get allEvents(): GameEvent[] {
    return [...this.events];
  }

  /**
   * Auto-detect melds for a player given the current trump
   */
  detectMeldsFor(playerIndex: PlayerIndex): Meld[] {
    const state = this.state;
    const hand = state.hands.get(playerIndex) || [];
    const trump = state.trump;

    if (!trump) {
      throw new Error('Cannot detect melds before trump is declared');
    }

    return detectMelds(hand, trump);
  }

  /**
   * Terminate the game (player exits)
   */
  terminateGame(terminatedBy: PlayerIndex): void {
    this.events.push(createGameTerminatedEvent(this.ctx(), terminatedBy, 'player_exit'));
  }
}
