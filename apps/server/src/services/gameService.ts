/**
 * Game service - handles game logic and event generation
 */

import {
  applyEvents,
  createDeck,
  createGameStartedEvent,
  createCardsDealtEvent,
  createBidPlacedEvent,
  createPlayerPassedEvent,
  createBiddingWonEvent,
  createDabbTakenEvent,
  createCardsDiscardedEvent,
  createTrumpDeclaredEvent,
  createMeldsDeclaredEvent,
  createMeldingCompleteEvent,
  createCardPlayedEvent,
  createTrickWonEvent,
  createPlayerJoinedEvent,
  dealCards,
  shuffleDeck,
  isValidBid,
  getBiddingWinner,
  isBiddingComplete,
  isValidPlay,
  determineTrickWinner,
  calculateTrickPoints,
  calculateMeldPoints,
} from '@dabb/game-logic';
import type {
  Card,
  CardId,
  GameEvent,
  GameState,
  Meld,
  PlayerIndex,
  Suit,
} from '@dabb/shared-types';
import { DABB_SIZE } from '@dabb/shared-types';

import { getAllEvents, getLastSequence, saveEvent } from './eventService.js';
import { getSessionById, getSessionPlayers, updateSessionStatus } from './sessionService.js';

// In-memory game state cache
const gameStates = new Map<string, GameState>();

async function getGameState(sessionId: string): Promise<GameState> {
  // Check cache first
  let state = gameStates.get(sessionId);
  if (state) return state;

  // Rebuild from events
  const events = await getAllEvents(sessionId);
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  state = applyEvents(events);
  gameStates.set(sessionId, state);

  return state;
}

function updateGameState(sessionId: string, event: GameEvent): GameState {
  const currentState = gameStates.get(sessionId);
  if (!currentState) {
    throw new Error('Game state not initialized');
  }

  const { applyEvent } = require('@dabb/game-logic');
  const newState = applyEvent(currentState, event);
  gameStates.set(sessionId, newState);

  return newState;
}

export async function startGame(sessionId: string): Promise<GameEvent[]> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error('Session not found');

  const players = await getSessionPlayers(sessionId);
  if (players.length !== session.playerCount) {
    throw new Error(`Need ${session.playerCount} players to start`);
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);

  const ctx = () => ({ sessionId, sequence: ++sequence });

  // Add player joined events if not already in state
  for (const player of players) {
    events.push(createPlayerJoinedEvent(
      ctx(),
      player.id,
      player.playerIndex,
      player.nickname,
      player.team
    ));
  }

  // Game started event
  const dealer = 0 as PlayerIndex;
  events.push(createGameStartedEvent(
    ctx(),
    session.playerCount,
    session.targetScore,
    dealer
  ));

  // Deal cards
  const deck = shuffleDeck(createDeck());
  const { hands, dabb } = dealCards(deck, session.playerCount);

  const handsRecord = {} as Record<PlayerIndex, Card[]>;
  hands.forEach((cards, index) => {
    handsRecord[index as PlayerIndex] = cards;
  });

  events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

  // Save events and update state
  for (const event of events) {
    await saveEvent(event);
  }

  // Initialize game state
  const state = applyEvents(events);
  gameStates.set(sessionId, state);

  await updateSessionStatus(sessionId, 'active');

  return events;
}

export async function placeBid(
  sessionId: string,
  playerIndex: PlayerIndex,
  amount: number
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'bidding') {
    throw new Error('Not in bidding phase');
  }

  if (state.currentBidder !== playerIndex) {
    throw new Error('Not your turn to bid');
  }

  if (!isValidBid(amount, state.currentBid)) {
    throw new Error('Invalid bid amount');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createBidPlacedEvent(ctx(), playerIndex, amount));

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function passBid(
  sessionId: string,
  playerIndex: PlayerIndex
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'bidding') {
    throw new Error('Not in bidding phase');
  }

  if (state.currentBidder !== playerIndex) {
    throw new Error('Not your turn');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createPlayerPassedEvent(ctx(), playerIndex));

  // Check if bidding is complete
  const newPassedPlayers = new Set(state.passedPlayers);
  newPassedPlayers.add(playerIndex);

  if (isBiddingComplete(state.playerCount, newPassedPlayers)) {
    const winner = getBiddingWinner(state.playerCount, newPassedPlayers);
    if (winner !== null) {
      events.push(createBiddingWonEvent(ctx(), winner, state.currentBid || 150));
    }
  }

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function takeDabb(
  sessionId: string,
  playerIndex: PlayerIndex
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'dabb') {
    throw new Error('Not in dabb phase');
  }

  if (state.bidWinner !== playerIndex) {
    throw new Error('Only bid winner can take dabb');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createDabbTakenEvent(ctx(), playerIndex, state.dabb));

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function discardCards(
  sessionId: string,
  playerIndex: PlayerIndex,
  cardIds: CardId[]
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'dabb') {
    throw new Error('Not in dabb phase');
  }

  if (state.bidWinner !== playerIndex) {
    throw new Error('Only bid winner can discard');
  }

  const hand = state.hands.get(playerIndex) || [];
  const dabbSize = DABB_SIZE[state.playerCount];

  if (cardIds.length !== dabbSize) {
    throw new Error(`Must discard exactly ${dabbSize} cards`);
  }

  // Verify all cards are in hand
  const handIds = new Set(hand.map(c => c.id));
  for (const cardId of cardIds) {
    if (!handIds.has(cardId)) {
      throw new Error('Card not in hand');
    }
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createCardsDiscardedEvent(ctx(), playerIndex, cardIds));

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function declareTrump(
  sessionId: string,
  playerIndex: PlayerIndex,
  suit: Suit
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'trump') {
    throw new Error('Not in trump declaration phase');
  }

  if (state.bidWinner !== playerIndex) {
    throw new Error('Only bid winner can declare trump');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createTrumpDeclaredEvent(ctx(), playerIndex, suit));

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function declareMelds(
  sessionId: string,
  playerIndex: PlayerIndex,
  melds: Meld[]
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'melding') {
    throw new Error('Not in melding phase');
  }

  if (state.declaredMelds.has(playerIndex)) {
    throw new Error('Already declared melds');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  const totalPoints = calculateMeldPoints(melds);
  events.push(createMeldsDeclaredEvent(ctx(), playerIndex, melds, totalPoints));

  // Check if all players have declared
  const declaredCount = state.declaredMelds.size + 1;
  if (declaredCount === state.playerCount) {
    const meldScores = {} as Record<PlayerIndex, number>;
    state.declaredMelds.forEach((m, idx) => {
      meldScores[idx] = calculateMeldPoints(m);
    });
    meldScores[playerIndex] = totalPoints;

    events.push(createMeldingCompleteEvent(ctx(), meldScores));
  }

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export async function playCard(
  sessionId: string,
  playerIndex: PlayerIndex,
  cardId: CardId
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'tricks') {
    throw new Error('Not in tricks phase');
  }

  if (state.currentPlayer !== playerIndex) {
    throw new Error('Not your turn');
  }

  const hand = state.hands.get(playerIndex) || [];
  const card = hand.find(c => c.id === cardId);

  if (!card) {
    throw new Error('Card not in hand');
  }

  if (!isValidPlay(card, hand, state.currentTrick, state.trump!)) {
    throw new Error('Invalid play');
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createCardPlayedEvent(ctx(), playerIndex, card));

  // Check if trick is complete
  if (state.currentTrick.cards.length + 1 === state.playerCount) {
    const newTrick = {
      cards: [
        ...state.currentTrick.cards,
        { cardId: card.id, playerIndex },
      ],
      leadSuit: state.currentTrick.leadSuit || card.suit,
      winnerIndex: null,
    };

    const winnerIdx = determineTrickWinner(newTrick, state.trump!);
    const winnerPlayerIndex = newTrick.cards[winnerIdx].playerIndex;

    const trickCards = newTrick.cards.map(pc => {
      const h = state.hands.get(pc.playerIndex) || [];
      return h.find(c => c.id === pc.cardId) || card; // fallback to current card
    });

    const points = calculateTrickPoints(trickCards);
    events.push(createTrickWonEvent(ctx(), winnerPlayerIndex, trickCards, points));

    // Check if round is over
    const remainingCards = (state.hands.get(playerIndex)?.length || 0) - 1;
    if (remainingCards === 0) {
      // Round scoring would go here
      // For now, just continue to next round or finish
    }
  }

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

export { getGameState };
