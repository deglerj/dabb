/**
 * Game service - handles game logic and event generation
 */

import {
  applyEvent,
  applyEvents,
  calculateMeldPoints,
  calculateTrickPoints,
  canPass,
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDealtEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createDeck,
  createGameFinishedEvent,
  createGameStartedEvent,
  createGameTerminatedEvent,
  createGoingOutEvent,
  createMeldingCompleteEvent,
  createMeldsDeclaredEvent,
  createNewRoundStartedEvent,
  createPlayerJoinedEvent,
  createPlayerPassedEvent,
  createRoundScoredEvent,
  createTrickWonEvent,
  createTrumpDeclaredEvent,
  dealCards,
  determineTrickWinner,
  getBiddingWinner,
  isBiddingComplete,
  isValidBid,
  isValidPlay,
  shuffleDeck,
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
import { DABB_SIZE, GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

import { getAllEvents, getLastSequence, saveEvent } from './eventService.js';
import { getSessionById, getSessionPlayers, updateSessionStatus } from './sessionService.js';

// In-memory game state cache
const gameStates = new Map<string, GameState>();

async function getGameState(sessionId: string): Promise<GameState> {
  // Check cache first
  let state = gameStates.get(sessionId);
  if (state) {
    return state;
  }

  // Rebuild from events
  const events = await getAllEvents(sessionId);
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
  }

  state = applyEvents(events);
  gameStates.set(sessionId, state);

  return state;
}

function updateGameState(sessionId: string, event: GameEvent): GameState {
  const currentState = gameStates.get(sessionId);
  if (!currentState) {
    throw new GameError(SERVER_ERROR_CODES.GAME_STATE_NOT_INITIALIZED);
  }

  const newState = applyEvent(currentState, event);
  gameStates.set(sessionId, newState);

  return newState;
}

export async function startGame(sessionId: string): Promise<GameEvent[]> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new GameError(SERVER_ERROR_CODES.SESSION_NOT_FOUND);
  }

  const players = await getSessionPlayers(sessionId);
  if (players.length !== session.playerCount) {
    throw new GameError(SERVER_ERROR_CODES.NOT_ENOUGH_PLAYERS, {
      required: session.playerCount,
    });
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);

  const ctx = () => ({ sessionId, sequence: ++sequence });

  // Add player joined events if not already in state
  for (const player of players) {
    events.push(
      createPlayerJoinedEvent(ctx(), player.id, player.playerIndex, player.nickname, player.team)
    );
  }

  // Game started event
  const dealer = 0 as PlayerIndex;
  events.push(createGameStartedEvent(ctx(), session.playerCount, session.targetScore, dealer));

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
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }

  if (state.currentBidder !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN_TO_BID);
  }

  if (!isValidBid(amount, state.currentBid)) {
    throw new GameError(SERVER_ERROR_CODES.INVALID_BID_AMOUNT);
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

export async function passBid(sessionId: string, playerIndex: PlayerIndex): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'bidding') {
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }

  if (state.currentBidder !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN);
  }

  if (!canPass(state.currentBid)) {
    throw new GameError(SERVER_ERROR_CODES.FIRST_BIDDER_MUST_BID);
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

export async function takeDabb(sessionId: string, playerIndex: PlayerIndex): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'dabb') {
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  }

  if (state.bidWinner !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
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
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  }

  if (state.bidWinner !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DISCARD);
  }

  const hand = state.hands.get(playerIndex) || [];
  const dabbSize = DABB_SIZE[state.playerCount];

  if (cardIds.length !== dabbSize) {
    throw new GameError(SERVER_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: dabbSize });
  }

  // Verify all cards are in hand
  const handIds = new Set(hand.map((c) => c.id));
  for (const cardId of cardIds) {
    if (!handIds.has(cardId)) {
      throw new GameError(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
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

export async function goOut(
  sessionId: string,
  playerIndex: PlayerIndex,
  suit: Suit
): Promise<GameEvent[]> {
  const state = await getGameState(sessionId);

  if (state.phase !== 'dabb') {
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  }

  if (state.bidWinner !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_GO_OUT);
  }

  if (state.dabb.length > 0) {
    throw new GameError(SERVER_ERROR_CODES.MUST_TAKE_DABB_BEFORE_GOING_OUT);
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createGoingOutEvent(ctx(), playerIndex, suit));

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
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_TRUMP_PHASE);
  }

  if (state.bidWinner !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
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
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_MELDING_PHASE);
  }

  // Bid winner cannot meld when they went out
  if (state.wentOut && playerIndex === state.bidWinner) {
    throw new GameError(SERVER_ERROR_CODES.CANNOT_MELD_WHEN_GOING_OUT);
  }

  if (state.declaredMelds.has(playerIndex)) {
    throw new GameError(SERVER_ERROR_CODES.ALREADY_DECLARED_MELDS);
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  const totalPoints = calculateMeldPoints(melds);
  events.push(createMeldsDeclaredEvent(ctx(), playerIndex, melds, totalPoints));

  // When going out, only playerCount - 1 players meld (bid winner doesn't meld)
  const expectedMeldCount = state.wentOut ? state.playerCount - 1 : state.playerCount;
  const declaredCount = state.declaredMelds.size + 1;

  if (declaredCount === expectedMeldCount) {
    const meldScores = {} as Record<PlayerIndex, number>;
    state.declaredMelds.forEach((m, idx) => {
      meldScores[idx] = calculateMeldPoints(m);
    });
    meldScores[playerIndex] = totalPoints;

    if (state.wentOut) {
      // Going out: skip tricks phase, score immediately
      // Bid winner gets 0 melds (they can't meld when going out)
      const bidWinner = state.bidWinner!;
      meldScores[bidWinner] = 0;

      events.push(createMeldingCompleteEvent(ctx(), meldScores));

      // Calculate going out scores
      const goingOutEvents = await calculateGoingOutScores(state, meldScores, ctx);
      events.push(...goingOutEvents);
    } else {
      events.push(createMeldingCompleteEvent(ctx(), meldScores));
    }
  }

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

/**
 * Calculate scores when bid winner goes out
 * - Bid winner loses their bid amount
 * - All other players get their melds + 40 bonus points
 */
async function calculateGoingOutScores(
  state: GameState,
  meldScores: Record<PlayerIndex, number>,
  ctx: () => { sessionId: string; sequence: number }
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];
  const bidWinner = state.bidWinner!;
  const winningBid = state.currentBid || 150;
  const goingOutBonus = 40;

  const scores = {} as Record<
    PlayerIndex,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;

  for (let i = 0; i < state.playerCount; i++) {
    const idx = i as PlayerIndex;
    if (idx === bidWinner) {
      // Bid winner loses bid amount, gets no points
      scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
    } else {
      // Other players get their melds + 40 bonus
      const melds = meldScores[idx] || 0;
      scores[idx] = { melds, tricks: 0, total: melds + goingOutBonus, bidMet: true };
    }
  }

  // Calculate new total scores
  const totalScores = {} as Record<PlayerIndex, number>;
  for (let i = 0; i < state.playerCount; i++) {
    const idx = i as PlayerIndex;
    const currentTotal = state.totalScores.get(idx) || 0;
    totalScores[idx] = currentTotal + scores[idx].total;
  }

  events.push(createRoundScoredEvent(ctx(), scores, totalScores));

  // Check if game is finished (someone reached target score)
  const targetScore = state.targetScore;
  let winner: PlayerIndex | null = null;
  let highestScore = 0;

  for (let i = 0; i < state.playerCount; i++) {
    const idx = i as PlayerIndex;
    if (totalScores[idx] >= targetScore && totalScores[idx] > highestScore) {
      winner = idx;
      highestScore = totalScores[idx];
    }
  }

  if (winner !== null) {
    events.push(createGameFinishedEvent(ctx(), winner, totalScores));
  } else {
    // Start new round
    const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
    events.push(createNewRoundStartedEvent(ctx(), state.round + 1, newDealer));

    // Deal cards for new round
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, state.playerCount);

    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });

    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));
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
    throw new GameError(SERVER_ERROR_CODES.NOT_IN_TRICKS_PHASE);
  }

  if (state.currentPlayer !== playerIndex) {
    throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN);
  }

  const hand = state.hands.get(playerIndex) || [];
  const card = hand.find((c) => c.id === cardId);

  if (!card) {
    throw new GameError(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
  }

  if (!isValidPlay(card, hand, state.currentTrick, state.trump!)) {
    throw new GameError(SERVER_ERROR_CODES.INVALID_PLAY);
  }

  const events: GameEvent[] = [];
  let sequence = await getLastSequence(sessionId);
  const ctx = () => ({ sessionId, sequence: ++sequence });

  events.push(createCardPlayedEvent(ctx(), playerIndex, card));

  // Check if trick is complete
  if (state.currentTrick.cards.length + 1 === state.playerCount) {
    const newTrick = {
      cards: [...state.currentTrick.cards, { cardId: card.id, card, playerIndex }],
      leadSuit: state.currentTrick.leadSuit || card.suit,
      winnerIndex: null,
    };

    const winnerIdx = determineTrickWinner(newTrick, state.trump!);
    const winnerPlayerIndex = newTrick.cards[winnerIdx].playerIndex;

    const trickCards = newTrick.cards.map((pc) => pc.card);

    const points = calculateTrickPoints(trickCards);
    events.push(createTrickWonEvent(ctx(), winnerPlayerIndex, trickCards, points));

    // Check if round is over (all cards played)
    const remainingCards = (state.hands.get(playerIndex)?.length || 0) - 1;
    if (remainingCards === 0) {
      // Apply events so far to get updated state with final trick
      let scoringState = state;
      for (const event of events) {
        scoringState = applyEvent(scoringState, event);
      }

      // Calculate round scores
      const scores = {} as Record<
        PlayerIndex,
        { melds: number; tricks: number; total: number; bidMet: boolean }
      >;

      const bidWinner = scoringState.bidWinner!;
      const winningBid = scoringState.currentBid || 150;

      for (let i = 0; i < scoringState.playerCount; i++) {
        const idx = i as PlayerIndex;
        const melds = calculateMeldPoints(scoringState.declaredMelds.get(idx) || []);
        const tricksCards = scoringState.tricksTaken.get(idx) || [];
        const tricks = tricksCards.reduce(
          (sum, trickCards) => sum + calculateTrickPoints(trickCards),
          0
        );
        const rawTotal = melds + tricks;
        const isBidWinner = idx === bidWinner;
        const bidMet = !isBidWinner || rawTotal >= winningBid;
        const total = isBidWinner && !bidMet ? -2 * winningBid : rawTotal;

        scores[idx] = { melds, tricks, total, bidMet };
      }

      // Calculate new total scores
      const totalScores = {} as Record<PlayerIndex, number>;
      for (let i = 0; i < scoringState.playerCount; i++) {
        const idx = i as PlayerIndex;
        const currentTotal = scoringState.totalScores.get(idx) || 0;
        const roundScore = scores[idx];

        totalScores[idx] = currentTotal + roundScore.total;
      }

      events.push(createRoundScoredEvent(ctx(), scores, totalScores));

      // Check if game is finished (someone reached target score)
      const targetScore = scoringState.targetScore;
      let winner: PlayerIndex | null = null;
      let highestScore = 0;

      for (let i = 0; i < scoringState.playerCount; i++) {
        const idx = i as PlayerIndex;
        if (totalScores[idx] >= targetScore && totalScores[idx] > highestScore) {
          winner = idx;
          highestScore = totalScores[idx];
        }
      }

      if (winner !== null) {
        events.push(createGameFinishedEvent(ctx(), winner, totalScores));
      } else {
        // Start new round
        const newDealer = ((scoringState.dealer + 1) % scoringState.playerCount) as PlayerIndex;
        events.push(createNewRoundStartedEvent(ctx(), scoringState.round + 1, newDealer));

        // Deal cards for new round
        const deck = shuffleDeck(createDeck());
        const { hands, dabb } = dealCards(deck, scoringState.playerCount);

        const handsRecord = {} as Record<PlayerIndex, Card[]>;
        hands.forEach((cards, index) => {
          handsRecord[index as PlayerIndex] = cards;
        });

        events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));
      }
    }
  }

  for (const event of events) {
    await saveEvent(event);
    updateGameState(sessionId, event);
  }

  return events;
}

/**
 * Terminate a game due to player exit
 * Returns the termination event for broadcasting
 */
export async function terminateGame(
  sessionId: string,
  playerIndex: PlayerIndex
): Promise<GameEvent> {
  const state = await getGameState(sessionId);

  // Only allow termination during active game phases
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  if (!activePhases.includes(state.phase)) {
    throw new GameError(SERVER_ERROR_CODES.CANNOT_TERMINATE_IN_CURRENT_PHASE);
  }

  const sequence = (await getLastSequence(sessionId)) + 1;
  const ctx = { sessionId, sequence };

  const event = createGameTerminatedEvent(ctx, playerIndex);

  await saveEvent(event);
  updateGameState(sessionId, event);

  await updateSessionStatus(sessionId, 'terminated');

  return event;
}

/**
 * Clear the cached game state for a session
 * Used when terminating inactive sessions
 */
export function clearGameStateCache(sessionId: string): void {
  gameStates.delete(sessionId);
}

export { getGameState };
