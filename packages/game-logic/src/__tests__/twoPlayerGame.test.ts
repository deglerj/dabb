import { describe, expect, it } from 'vitest';

import { applyEvents } from '../state/reducer.js';
import { createDeck, dealCards, shuffleDeck } from '../cards/deck.js';
import {
  createPlayerJoinedEvent,
  createGameStartedEvent,
  createCardsDealtEvent,
} from '../events/generators.js';
import { filterEventsForPlayer } from '../state/views.js';
import { getFirstBidder } from '../phases/bidding.js';
import type { PlayerIndex, Card, GameEvent } from '@dabb/shared-types';

/**
 * Test to reproduce error when starting a 2-player game
 */
describe('Two Player Game Start', () => {
  it('should successfully start a 2-player game', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const events: GameEvent[] = [];

    // Add player joined events
    events.push(createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined));
    events.push(createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined));

    // Game started event with 2 players
    events.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    // Deal cards for 2 players
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);

    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });

    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Apply events and verify state
    const state = applyEvents(events);

    expect(state.phase).toBe('bidding');
    expect(state.playerCount).toBe(2);
    expect(state.players).toHaveLength(2);
    expect(state.hands.size).toBe(2);
    expect(state.hands.get(0 as PlayerIndex)).toHaveLength(18);
    expect(state.hands.get(1 as PlayerIndex)).toHaveLength(18);
    expect(state.dabb).toHaveLength(4);
  });

  it('should filter events correctly for each player in 2-player game', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const events: GameEvent[] = [];

    // Add player joined events
    events.push(createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined));
    events.push(createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined));

    // Game started event with 2 players
    events.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    // Deal cards for 2 players
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);

    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });

    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Filter events for player 0
    const player0Events = filterEventsForPlayer(events, 0 as PlayerIndex);
    const state0 = applyEvents(player0Events);

    expect(state0.phase).toBe('bidding');
    expect(state0.playerCount).toBe(2);
    expect(state0.hands.get(0 as PlayerIndex)).toHaveLength(18);
    expect(state0.hands.get(1 as PlayerIndex)).toHaveLength(18);

    // Filter events for player 1
    const player1Events = filterEventsForPlayer(events, 1 as PlayerIndex);
    const state1 = applyEvents(player1Events);

    expect(state1.phase).toBe('bidding');
    expect(state1.playerCount).toBe(2);
    expect(state1.hands.get(0 as PlayerIndex)).toHaveLength(18);
    expect(state1.hands.get(1 as PlayerIndex)).toHaveLength(18);
  });

  it('should set correct first bidder for 2-player game (dealer = 0)', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const events: GameEvent[] = [];

    events.push(createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined));
    events.push(createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined));

    events.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);

    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });

    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    const state = applyEvents(events);

    // First bidder should be (dealer + 1) % playerCount = (0 + 1) % 2 = 1
    expect(state.currentBidder).toBe(1);
    expect(state.dealer).toBe(0);
  });

  it('should compute first bidder correctly with getFirstBidder for 2 players', () => {
    // Test all dealer positions for 2-player game
    expect(getFirstBidder(0 as PlayerIndex, 2)).toBe(1);
    expect(getFirstBidder(1 as PlayerIndex, 2)).toBe(0);
  });

  it('should handle client-side state computation correctly for player 0', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    // Create events as they would be generated on the server
    const serverEvents: GameEvent[] = [];

    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined)
    );
    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined)
    );
    serverEvents.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    serverEvents.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Simulate client-side: filter events for player 0
    const player0Events = filterEventsForPlayer(serverEvents, 0 as PlayerIndex);

    // Apply events as the client would
    const state = applyEvents(player0Events);

    // Verify the state is valid
    expect(state.phase).toBe('bidding');
    expect(state.playerCount).toBe(2);
    expect(state.players).toHaveLength(2);
    expect(state.dealer).toBe(0);
    expect(state.currentBidder).toBe(1);

    // Player 0's hand should have real cards
    const player0Hand = state.hands.get(0 as PlayerIndex);
    expect(player0Hand).toBeDefined();
    expect(player0Hand).toHaveLength(18);
    expect(player0Hand![0].id).not.toMatch(/^hidden-/);

    // Player 1's hand should have hidden cards
    const player1Hand = state.hands.get(1 as PlayerIndex);
    expect(player1Hand).toBeDefined();
    expect(player1Hand).toHaveLength(18);
    expect(player1Hand![0].id).toMatch(/^hidden-/);
  });

  it('should handle client-side state computation correctly for player 1', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    // Create events as they would be generated on the server
    const serverEvents: GameEvent[] = [];

    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined)
    );
    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined)
    );
    serverEvents.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    serverEvents.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Simulate client-side: filter events for player 1
    const player1Events = filterEventsForPlayer(serverEvents, 1 as PlayerIndex);

    // Apply events as the client would
    const state = applyEvents(player1Events);

    // Verify the state is valid
    expect(state.phase).toBe('bidding');
    expect(state.playerCount).toBe(2);
    expect(state.players).toHaveLength(2);
    expect(state.dealer).toBe(0);
    expect(state.currentBidder).toBe(1);

    // Player 0's hand should have hidden cards
    const player0Hand = state.hands.get(0 as PlayerIndex);
    expect(player0Hand).toBeDefined();
    expect(player0Hand).toHaveLength(18);
    expect(player0Hand![0].id).toMatch(/^hidden-/);

    // Player 1's hand should have real cards
    const player1Hand = state.hands.get(1 as PlayerIndex);
    expect(player1Hand).toBeDefined();
    expect(player1Hand).toHaveLength(18);
    expect(player1Hand![0].id).not.toMatch(/^hidden-/);
  });

  it('should have valid dabb in filtered events', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const serverEvents: GameEvent[] = [];

    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined)
    );
    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined)
    );
    serverEvents.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    serverEvents.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Filter for any player - dabb should be hidden
    const filteredEvents = filterEventsForPlayer(serverEvents, 0 as PlayerIndex);
    const state = applyEvents(filteredEvents);

    // Dabb should have 4 hidden cards
    expect(state.dabb).toHaveLength(4);
    expect(state.dabb[0].id).toMatch(/^hidden-/);
  });

  it('should have all required state properties for 2-player game UI', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const serverEvents: GameEvent[] = [];

    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined)
    );
    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined)
    );
    serverEvents.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    serverEvents.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    // Simulate client-side for player 0
    const player0Events = filterEventsForPlayer(serverEvents, 0 as PlayerIndex);
    const state = applyEvents(player0Events);

    // All these properties should be valid and not cause errors when accessed
    expect(state.phase).toBe('bidding');
    expect(state.playerCount).toBe(2);
    expect(state.players).toHaveLength(2);
    expect(state.players[0].playerIndex).toBe(0);
    expect(state.players[1].playerIndex).toBe(1);
    expect(state.hands.size).toBe(2);
    expect(state.hands.get(0 as PlayerIndex)).toBeDefined();
    expect(state.hands.get(1 as PlayerIndex)).toBeDefined();
    expect(state.dabb).toHaveLength(4);
    expect(state.currentBid).toBe(0);
    expect(state.bidWinner).toBeNull();
    expect(state.currentBidder).toBe(1); // First bidder is player 1 (dealer + 1)
    expect(state.passedPlayers.size).toBe(0);
    expect(state.trump).toBeNull();
    expect(state.currentTrick.cards).toHaveLength(0);
    expect(state.tricksTaken.size).toBe(0);
    expect(state.currentPlayer).toBeNull();
    expect(state.totalScores.size).toBe(0); // Empty until round is scored
    expect(state.targetScore).toBe(1000);
    expect(state.declaredMelds.size).toBe(0);
    expect(state.dealer).toBe(0);
    expect(state.round).toBe(1);
  });

  it('should handle iteration over totalScores.keys() for 2 players', () => {
    const sessionId = 'test-session';
    let sequence = 0;
    const ctx = () => ({ sessionId, sequence: ++sequence });

    const serverEvents: GameEvent[] = [];

    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-1', 0 as PlayerIndex, 'Alice', undefined)
    );
    serverEvents.push(
      createPlayerJoinedEvent(ctx(), 'player-2', 1 as PlayerIndex, 'Bob', undefined)
    );
    serverEvents.push(createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    serverEvents.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    const player0Events = filterEventsForPlayer(serverEvents, 0 as PlayerIndex);
    const state = applyEvents(player0Events);

    // This is how the ScoreBoard component accesses scoring entities
    const scoringEntities = Array.from(state.totalScores.keys());

    // Initially empty, should not cause errors
    expect(Array.isArray(scoringEntities)).toBe(true);
    expect(scoringEntities.length).toBe(0);

    // Iteration over players should also work
    for (const player of state.players) {
      const score = state.totalScores.get(player.playerIndex) ?? 0;
      expect(typeof score).toBe('number');
    }
  });
});
