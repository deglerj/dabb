import {
  applyEvent,
  calculateMeldPoints,
  calculatePlayerTrickRawPoints,
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
  detectMelds,
  determineGameWinner,
  determineTrickWinner,
  getBiddingWinner,
  isBiddingComplete,
  isPartnerWinning,
  isValidBid,
  isValidPlay,
  shuffleDeck,
} from '@dabb/game-logic';
import type {
  Card,
  CardId,
  GameEvent,
  GameState,
  PlayerCount,
  PlayerIndex,
  Suit,
  Team,
} from '@dabb/shared-types';
import { DABB_SIZE, GameError, GAME_ERROR_CODES } from '@dabb/shared-types';

export type SeqGen = () => number;

export interface PlayerInfo {
  playerIndex: PlayerIndex;
  nickname: string;
  isAI: boolean;
  team: Team | null;
}

function ctx(sessionId: string, seq: SeqGen) {
  return { sessionId, sequence: seq() };
}

export function createStartGameEvents(
  sessionCode: string,
  seq: SeqGen,
  players: PlayerInfo[],
  playerCount: PlayerCount,
  targetScore: number
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const player of players) {
    // 4-player: partners sit opposite each other, so seat parity decides the team
    const team = playerCount === 4 ? ((player.playerIndex % 2) as Team) : player.team;
    events.push(
      createPlayerJoinedEvent(
        ctx(sessionCode, seq),
        `player-${player.playerIndex}`,
        player.playerIndex,
        player.nickname,
        team ?? undefined
      )
    );
  }

  const initialDealer = (playerCount - 1) as PlayerIndex;
  events.push(
    createGameStartedEvent(ctx(sessionCode, seq), playerCount, targetScore, initialDealer)
  );

  const deck = shuffleDeck(createDeck());
  const { hands, dabb } = dealCards(deck, playerCount);
  const handsRecord = {} as Record<PlayerIndex, Card[]>;
  hands.forEach((cards, idx) => {
    handsRecord[idx as PlayerIndex] = cards;
  });
  events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));

  return events;
}

export function createBidPlacedEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  amount: number
): GameEvent[] {
  if (state.phase !== 'bidding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }
  if (state.currentBidder !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN_TO_BID);
  }
  if (!isValidBid(amount, state.currentBid)) {
    throw new GameError(GAME_ERROR_CODES.INVALID_BID_AMOUNT);
  }
  return [createBidPlacedEvent(ctx(sessionCode, seq), playerIndex, amount)];
}

export function createPlayerPassedEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'bidding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  }
  if (state.currentBidder !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN);
  }
  if (!canPass(state.currentBid)) {
    throw new GameError(GAME_ERROR_CODES.FIRST_BIDDER_MUST_BID);
  }

  const events: GameEvent[] = [];
  events.push(createPlayerPassedEvent(ctx(sessionCode, seq), playerIndex));

  const newPassedPlayers = new Set(state.passedPlayers);
  newPassedPlayers.add(playerIndex);

  if (isBiddingComplete(state.playerCount, newPassedPlayers)) {
    const winner = getBiddingWinner(state.playerCount, newPassedPlayers);
    if (winner !== null) {
      events.push(
        createBiddingWonEvent(ctx(sessionCode, seq), winner, state.currentBid || 150, state.dabb)
      );
    }
  }

  return events;
}

export function createTakeDabbEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'dabb') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
  }
  return [createDabbTakenEvent(ctx(sessionCode, seq), playerIndex, state.dabb)];
}

export function createDiscardCardsEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  cardIds: CardId[]
): GameEvent[] {
  if (state.phase !== 'discard') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_DISCARD);
  }

  const dabbSize = DABB_SIZE[state.playerCount];
  if (cardIds.length !== dabbSize) {
    throw new GameError(GAME_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: dabbSize });
  }

  const hand = state.hands.get(playerIndex) ?? [];
  const handIds = new Set(hand.map((c) => c.id));
  for (const cardId of cardIds) {
    if (!handIds.has(cardId)) {
      throw new GameError(GAME_ERROR_CODES.CARD_NOT_IN_HAND);
    }
  }

  return [createCardsDiscardedEvent(ctx(sessionCode, seq), playerIndex, cardIds)];
}

/** Going out replaces the layaway, so it happens in the discard phase with trump already set. */
export function createGoOutEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'discard') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_DABB_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_GO_OUT);
  }
  if (state.dabb.length > 0) {
    throw new GameError(GAME_ERROR_CODES.MUST_TAKE_DABB_BEFORE_GOING_OUT);
  }
  return [createGoingOutEvent(ctx(sessionCode, seq), playerIndex, state.trump!)];
}

export function createDeclareTrumpEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  suit: Suit
): GameEvent[] {
  if (state.phase !== 'trump') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_TRUMP_PHASE);
  }
  if (state.bidWinner !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
  }
  return [createTrumpDeclaredEvent(ctx(sessionCode, seq), playerIndex, suit)];
}

/**
 * Melds are derived here from the player's own hand rather than accepted from the caller —
 * the UI and the AI both declare every meld they hold, so a caller-supplied list could only
 * ever disagree with the hand it claims to describe.
 */
export function createDeclareMeldsEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'melding') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_MELDING_PHASE);
  }
  if (state.wentOut && playerIndex === state.bidWinner) {
    throw new GameError(GAME_ERROR_CODES.CANNOT_MELD_WHEN_GOING_OUT);
  }
  if (state.declaredMelds.has(playerIndex)) {
    throw new GameError(GAME_ERROR_CODES.ALREADY_DECLARED_MELDS);
  }

  const events: GameEvent[] = [];
  const melds = detectMelds(state.hands.get(playerIndex) ?? [], state.trump!);
  const totalPoints = calculateMeldPoints(melds);
  events.push(createMeldsDeclaredEvent(ctx(sessionCode, seq), playerIndex, melds, totalPoints));

  const expectedMeldCount = state.wentOut ? state.playerCount - 1 : state.playerCount;
  const declaredCount = state.declaredMelds.size + 1;

  if (declaredCount === expectedMeldCount) {
    const meldScores = {} as Record<PlayerIndex, number>;
    state.declaredMelds.forEach((m, idx) => {
      meldScores[idx] = calculateMeldPoints(m);
    });
    meldScores[playerIndex] = totalPoints;

    if (state.wentOut) {
      const bidWinner = state.bidWinner!;
      meldScores[bidWinner] = 0;
      events.push(createMeldingCompleteEvent(ctx(sessionCode, seq), meldScores));

      const cascadeEvents = createGoingOutScoreEvents(sessionCode, seq, state, meldScores);
      events.push(...cascadeEvents);
    } else {
      events.push(createMeldingCompleteEvent(ctx(sessionCode, seq), meldScores));
    }
  }

  return events;
}

export function createPlayCardEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  cardId: CardId
): GameEvent[] {
  if (state.phase !== 'tricks') {
    throw new GameError(GAME_ERROR_CODES.NOT_IN_TRICKS_PHASE);
  }
  if (state.currentPlayer !== playerIndex) {
    throw new GameError(GAME_ERROR_CODES.NOT_YOUR_TURN);
  }

  const hand = state.hands.get(playerIndex) ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    throw new GameError(GAME_ERROR_CODES.CARD_NOT_IN_HAND);
  }
  const partnerWinning = isPartnerWinning(
    state.currentTrick,
    state.trump!,
    playerIndex,
    state.players
  );
  if (!isValidPlay(card, hand, state.currentTrick, state.trump!, partnerWinning)) {
    throw new GameError(GAME_ERROR_CODES.INVALID_PLAY);
  }

  const events: GameEvent[] = [];
  events.push(createCardPlayedEvent(ctx(sessionCode, seq), playerIndex, card));

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
    events.push(createTrickWonEvent(ctx(sessionCode, seq), winnerPlayerIndex, trickCards, points));

    const remainingCards = (state.hands.get(playerIndex)?.length ?? 0) - 1;
    if (remainingCards === 0) {
      let scoringState = state;
      for (const event of events) {
        scoringState = applyEvent(scoringState, event);
      }
      const roundEvents = createRoundEndEvents(sessionCode, seq, scoringState);
      events.push(...roundEvents);
    }
  }

  return events;
}

export function createTerminateGameEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  if (!activePhases.includes(state.phase)) {
    throw new GameError(GAME_ERROR_CODES.CANNOT_TERMINATE_IN_CURRENT_PHASE);
  }
  return [createGameTerminatedEvent(ctx(sessionCode, seq), playerIndex)];
}

/**
 * Team lookups read `state.players` (populated from PLAYER_JOINED), not the caller's
 * PlayerInfo[] — the latter comes from Firebase session meta, which has no team field.
 */
function getPlayerTeam(state: GameState, playerIndex: PlayerIndex): Team {
  const team = state.players.find((p) => p.playerIndex === playerIndex)?.team;
  if (team === undefined) {
    throw new GameError(GAME_ERROR_CODES.UNKNOWN_ERROR);
  }
  return team;
}

function getTeamPlayerIndices(state: GameState, team: Team): PlayerIndex[] {
  return state.players.filter((p) => p.team === team).map((p) => p.playerIndex);
}

function createRoundEndEvents(sessionCode: string, seq: SeqGen, state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const bidWinner = state.bidWinner!;
  const winningBid = state.currentBid || 150;

  const scores = {} as Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;
  const totalScores = {} as Record<PlayerIndex | Team, number>;

  if (state.playerCount === 4) {
    const playerMelds = new Map<PlayerIndex, number>();
    const playerTricksRaw = new Map<PlayerIndex, number>();
    for (let i = 0; i < 4; i++) {
      const idx = i as PlayerIndex;
      playerMelds.set(idx, calculateMeldPoints(state.declaredMelds.get(idx) ?? []));
      playerTricksRaw.set(
        idx,
        calculatePlayerTrickRawPoints(
          idx,
          state.tricksTaken,
          state.lastCompletedTrick?.winnerIndex ?? null
        )
      );
    }

    const bidWinnerTeam = getPlayerTeam(state, bidWinner);
    for (const team of [0, 1] as Team[]) {
      const indices = getTeamPlayerIndices(state, team);
      const teamMelds = indices.reduce<number>((s, idx) => s + playerMelds.get(idx)!, 0);
      // Round the team's trick total once — rounding each player first would inflate
      // the team score and break the 250-points-per-round invariant.
      const teamTricksRaw = indices.reduce<number>((s, idx) => s + playerTricksRaw.get(idx)!, 0);
      const teamTricks = Math.round(teamTricksRaw / 10) * 10;
      const rawTotal = teamMelds + teamTricks;
      const isBidWinnerTeam = team === bidWinnerTeam;
      const bidMet = !isBidWinnerTeam || rawTotal >= winningBid;
      const total = isBidWinnerTeam && !bidMet ? -2 * winningBid : rawTotal;
      scores[team] = { melds: teamMelds, tricks: teamTricks, total, bidMet };
    }

    for (const team of [0, 1] as Team[]) {
      const prev = state.totalScores.get(team) ?? 0;
      totalScores[team] = prev + scores[team].total;
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      const melds = calculateMeldPoints(state.declaredMelds.get(idx) ?? []);
      const tricksRaw = calculatePlayerTrickRawPoints(
        idx,
        state.tricksTaken,
        state.lastCompletedTrick?.winnerIndex ?? null
      );
      const tricks = Math.round(tricksRaw / 10) * 10;
      const rawTotal = melds + tricks;
      const isBidWinner = idx === bidWinner;
      const bidMet = !isBidWinner || rawTotal >= winningBid;
      const total = isBidWinner && !bidMet ? -2 * winningBid : rawTotal;
      scores[idx] = { melds, tricks, total, bidMet };
    }

    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      totalScores[idx] = (state.totalScores.get(idx) ?? 0) + scores[idx].total;
    }
  }

  events.push(createRoundScoredEvent(ctx(sessionCode, seq), scores, totalScores));

  const isTeamGame = state.playerCount === 4;
  const candidates: (PlayerIndex | Team)[] = isTeamGame
    ? [0, 1]
    : Array.from({ length: state.playerCount }, (_, i) => i as PlayerIndex);
  const winner = determineGameWinner(
    totalScores,
    candidates,
    state.targetScore,
    isTeamGame ? getPlayerTeam(state, bidWinner) : bidWinner
  );

  if (winner !== null) {
    events.push(createGameFinishedEvent(ctx(sessionCode, seq), winner, totalScores));
  } else {
    const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
    events.push(createNewRoundStartedEvent(ctx(sessionCode, seq), state.round + 1, newDealer));
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, state.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));
  }

  return events;
}

function createGoingOutScoreEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  meldScores: Record<PlayerIndex, number>
): GameEvent[] {
  const events: GameEvent[] = [];
  const bidWinner = state.bidWinner!;
  const winningBid = state.currentBid || 150;
  const goingOutBonus = 40;

  const scores = {} as Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;
  const totalScores = {} as Record<PlayerIndex | Team, number>;

  if (state.playerCount === 4) {
    const bidWinnerTeam = getPlayerTeam(state, bidWinner);
    const opponentTeam = (1 - bidWinnerTeam) as Team;
    scores[bidWinnerTeam] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };

    const opponentIndices = getTeamPlayerIndices(state, opponentTeam);
    const opponentMelds = opponentIndices.reduce<number>((s, idx) => s + (meldScores[idx] ?? 0), 0);
    scores[opponentTeam] = {
      melds: opponentMelds,
      tricks: 0,
      total: opponentMelds + goingOutBonus,
      bidMet: true,
    };

    for (const team of [0, 1] as Team[]) {
      totalScores[team] = (state.totalScores.get(team) ?? 0) + scores[team].total;
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (idx === bidWinner) {
        scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
      } else {
        const m = meldScores[idx] ?? 0;
        scores[idx] = { melds: m, tricks: 0, total: m + goingOutBonus, bidMet: true };
      }
      totalScores[idx] = (state.totalScores.get(idx) ?? 0) + scores[idx].total;
    }
  }

  events.push(createRoundScoredEvent(ctx(sessionCode, seq), scores, totalScores));

  const isTeamGame = state.playerCount === 4;
  const candidates: (PlayerIndex | Team)[] = isTeamGame
    ? [0, 1]
    : Array.from({ length: state.playerCount }, (_, i) => i as PlayerIndex);
  const winner = determineGameWinner(
    totalScores,
    candidates,
    state.targetScore,
    isTeamGame ? getPlayerTeam(state, bidWinner) : bidWinner
  );

  if (winner !== null) {
    events.push(createGameFinishedEvent(ctx(sessionCode, seq), winner, totalScores));
  } else {
    const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
    events.push(createNewRoundStartedEvent(ctx(sessionCode, seq), state.round + 1, newDealer));
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, state.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));
  }

  return events;
}
