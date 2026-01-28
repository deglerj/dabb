/**
 * Event sourcing reducer for game state
 */

import { Card, GameEvent, GameState, PlayerIndex, Trick } from '@dabb/shared-types';

import { getFirstBidder, getNextBidder, isBiddingComplete } from '../phases/bidding.js';
import { createInitialState, resetForNewRound } from './initial.js';

/**
 * Apply a single event to the game state
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'GAME_STARTED':
      return handleGameStarted(state, event);

    case 'PLAYER_JOINED':
      return handlePlayerJoined(state, event);

    case 'PLAYER_LEFT':
      return handlePlayerLeft(state, event);

    case 'PLAYER_RECONNECTED':
      return handlePlayerReconnected(state, event);

    case 'CARDS_DEALT':
      return handleCardsDealt(state, event);

    case 'BID_PLACED':
      return handleBidPlaced(state, event);

    case 'PLAYER_PASSED':
      return handlePlayerPassed(state, event);

    case 'BIDDING_WON':
      return handleBiddingWon(state, event);

    case 'DABB_TAKEN':
      return handleDabbTaken(state, event);

    case 'CARDS_DISCARDED':
      return handleCardsDiscarded(state, event);

    case 'TRUMP_DECLARED':
      return handleTrumpDeclared(state, event);

    case 'MELDS_DECLARED':
      return handleMeldsDeclared(state, event);

    case 'MELDING_COMPLETE':
      return handleMeldingComplete(state, event);

    case 'CARD_PLAYED':
      return handleCardPlayed(state, event);

    case 'TRICK_WON':
      return handleTrickWon(state, event);

    case 'ROUND_SCORED':
      return handleRoundScored(state, event);

    case 'GAME_FINISHED':
      return handleGameFinished(state, event);

    case 'NEW_ROUND_STARTED':
      return handleNewRoundStarted(state, event);

    default:
      return state;
  }
}

/**
 * Apply multiple events to build state
 */
export function applyEvents(events: GameEvent[], initialState?: GameState): GameState {
  let state = initialState || createInitialState(4);

  for (const event of events) {
    state = applyEvent(state, event);
  }

  return state;
}

// Event handlers

function handleGameStarted(
  state: GameState,
  event: Extract<GameEvent, { type: 'GAME_STARTED' }>
): GameState {
  return {
    ...createInitialState(event.payload.playerCount as 2 | 3 | 4, event.payload.targetScore),
    players: state.players,
    dealer: event.payload.dealer,
    phase: 'dealing',
    round: 1,
  };
}

function handlePlayerJoined(
  state: GameState,
  event: Extract<GameEvent, { type: 'PLAYER_JOINED' }>
): GameState {
  const newPlayer = {
    id: event.payload.playerId,
    nickname: event.payload.nickname,
    playerIndex: event.payload.playerIndex,
    team: event.payload.team,
    connected: true,
  };

  return {
    ...state,
    players: [...state.players, newPlayer],
  };
}

function handlePlayerLeft(
  state: GameState,
  event: Extract<GameEvent, { type: 'PLAYER_LEFT' }>
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerIndex === event.payload.playerIndex ? { ...p, connected: false } : p
    ),
  };
}

function handlePlayerReconnected(
  state: GameState,
  event: Extract<GameEvent, { type: 'PLAYER_RECONNECTED' }>
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerIndex === event.payload.playerIndex ? { ...p, connected: true } : p
    ),
  };
}

function handleCardsDealt(
  state: GameState,
  event: Extract<GameEvent, { type: 'CARDS_DEALT' }>
): GameState {
  const hands = new Map<PlayerIndex, Card[]>();

  for (const [indexStr, cards] of Object.entries(event.payload.hands)) {
    hands.set(parseInt(indexStr) as PlayerIndex, cards);
  }

  const firstBidder = getFirstBidder(state.dealer, state.playerCount);

  return {
    ...state,
    phase: 'bidding',
    hands,
    dabb: event.payload.dabb,
    currentBidder: firstBidder,
  };
}

function handleBidPlaced(
  state: GameState,
  event: Extract<GameEvent, { type: 'BID_PLACED' }>
): GameState {
  const nextBidder = getNextBidder(
    event.payload.playerIndex,
    state.playerCount,
    state.passedPlayers
  );

  return {
    ...state,
    currentBid: event.payload.amount,
    currentBidder: nextBidder,
  };
}

function handlePlayerPassed(
  state: GameState,
  event: Extract<GameEvent, { type: 'PLAYER_PASSED' }>
): GameState {
  const newPassedPlayers = new Set(state.passedPlayers);
  newPassedPlayers.add(event.payload.playerIndex);

  const biddingComplete = isBiddingComplete(state.playerCount, newPassedPlayers);

  const nextBidder = biddingComplete
    ? null
    : getNextBidder(event.payload.playerIndex, state.playerCount, newPassedPlayers);

  return {
    ...state,
    passedPlayers: newPassedPlayers,
    currentBidder: nextBidder,
  };
}

function handleBiddingWon(
  state: GameState,
  event: Extract<GameEvent, { type: 'BIDDING_WON' }>
): GameState {
  return {
    ...state,
    phase: 'dabb',
    bidWinner: event.payload.playerIndex,
    currentBid: event.payload.winningBid,
    currentBidder: null,
  };
}

function handleDabbTaken(
  state: GameState,
  event: Extract<GameEvent, { type: 'DABB_TAKEN' }>
): GameState {
  const currentHand = state.hands.get(event.payload.playerIndex) || [];
  const newHand = [...currentHand, ...event.payload.dabbCards];

  const newHands = new Map(state.hands);
  newHands.set(event.payload.playerIndex, newHand);

  return {
    ...state,
    hands: newHands,
    dabb: [], // Dabb is now empty
  };
}

function handleCardsDiscarded(
  state: GameState,
  event: Extract<GameEvent, { type: 'CARDS_DISCARDED' }>
): GameState {
  const currentHand = state.hands.get(event.payload.playerIndex) || [];
  const discardedIds = new Set(event.payload.discardedCards);
  const newHand = currentHand.filter((c) => !discardedIds.has(c.id));

  const newHands = new Map(state.hands);
  newHands.set(event.payload.playerIndex, newHand);

  return {
    ...state,
    phase: 'trump',
    hands: newHands,
  };
}

function handleTrumpDeclared(
  state: GameState,
  event: Extract<GameEvent, { type: 'TRUMP_DECLARED' }>
): GameState {
  return {
    ...state,
    phase: 'melding',
    trump: event.payload.suit,
    declaredMelds: new Map(),
  };
}

function handleMeldsDeclared(
  state: GameState,
  event: Extract<GameEvent, { type: 'MELDS_DECLARED' }>
): GameState {
  const newMelds = new Map(state.declaredMelds);
  newMelds.set(event.payload.playerIndex, event.payload.melds);

  return {
    ...state,
    declaredMelds: newMelds,
  };
}

function handleMeldingComplete(
  state: GameState,
  _event: Extract<GameEvent, { type: 'MELDING_COMPLETE' }>
): GameState {
  // Initialize tricks taken for each player
  const tricksTaken = new Map<PlayerIndex, Card[][]>();
  for (let i = 0; i < state.playerCount; i++) {
    tricksTaken.set(i as PlayerIndex, []);
  }

  return {
    ...state,
    phase: 'tricks',
    tricksTaken,
    currentPlayer: state.bidWinner,
    currentTrick: {
      cards: [],
      leadSuit: null,
      winnerIndex: null,
    },
  };
}

function handleCardPlayed(
  state: GameState,
  event: Extract<GameEvent, { type: 'CARD_PLAYED' }>
): GameState {
  // Remove card from player's hand
  const currentHand = state.hands.get(event.payload.playerIndex) || [];
  const newHand = currentHand.filter((c) => c.id !== event.payload.card.id);

  const newHands = new Map(state.hands);
  newHands.set(event.payload.playerIndex, newHand);

  // Add card to current trick
  const newTrick: Trick = {
    cards: [
      ...state.currentTrick.cards,
      { cardId: event.payload.card.id, playerIndex: event.payload.playerIndex },
    ],
    leadSuit: state.currentTrick.leadSuit || event.payload.card.suit,
    winnerIndex: null,
  };

  // Determine next player
  const nextPlayer = ((event.payload.playerIndex + 1) % state.playerCount) as PlayerIndex;

  return {
    ...state,
    hands: newHands,
    currentTrick: newTrick,
    currentPlayer: nextPlayer,
  };
}

function handleTrickWon(
  state: GameState,
  event: Extract<GameEvent, { type: 'TRICK_WON' }>
): GameState {
  // Add won cards to winner's tricks
  const winnerTricks = state.tricksTaken.get(event.payload.winnerIndex) || [];
  const newTricksTaken = new Map(state.tricksTaken);
  newTricksTaken.set(event.payload.winnerIndex, [...winnerTricks, event.payload.cards]);

  // Reset trick, winner leads next
  return {
    ...state,
    tricksTaken: newTricksTaken,
    currentTrick: {
      cards: [],
      leadSuit: null,
      winnerIndex: null,
    },
    currentPlayer: event.payload.winnerIndex,
  };
}

function handleRoundScored(
  state: GameState,
  event: Extract<GameEvent, { type: 'ROUND_SCORED' }>
): GameState {
  const totalScores = new Map(state.totalScores);

  for (const [key, score] of Object.entries(event.payload.totalScores)) {
    const playerOrTeam = parseInt(key) as PlayerIndex;
    totalScores.set(playerOrTeam, score);
  }

  return {
    ...state,
    phase: 'scoring',
    totalScores,
  };
}

function handleGameFinished(
  state: GameState,
  _event: Extract<GameEvent, { type: 'GAME_FINISHED' }>
): GameState {
  return {
    ...state,
    phase: 'finished',
  };
}

function handleNewRoundStarted(
  state: GameState,
  event: Extract<GameEvent, { type: 'NEW_ROUND_STARTED' }>
): GameState {
  return {
    ...resetForNewRound(state),
    dealer: event.payload.dealer,
    round: event.payload.round,
  };
}
