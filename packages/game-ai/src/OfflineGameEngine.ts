/**
 * OfflineGameEngine — drives a local Dabb game for offline play.
 *
 * Mirrors SimulationEngine (apps/server/src/simulation/SimulationEngine.ts)
 * but pauses when it's the human player's turn, waiting for dispatch().
 */
import { v4 as uuidv4 } from 'uuid';
import {
  applyEvent,
  applyEvents,
  calculateMeldPoints,
  calculatePlayerTrickRawPoints,
  calculateTrickPoints,
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDealtEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createGameFinishedEvent,
  createGameStartedEvent,
  createGoingOutEvent,
  createInitialState,
  createMeldingCompleteEvent,
  createMeldsDeclaredEvent,
  createNewRoundStartedEvent,
  createPlayerJoinedEvent,
  createPlayerPassedEvent,
  createRoundScoredEvent,
  createTrickWonEvent,
  createTrumpDeclaredEvent,
  createDeck,
  dealCards,
  determineTrickWinner,
  getBiddingWinner,
  isBiddingComplete,
  shuffleDeck,
  filterEventsForPlayer,
} from '@dabb/game-logic';
import type {
  AIAction,
  Card,
  GameEvent,
  GamePhase,
  GameState,
  PlayerCount,
  PlayerIndex,
  Team,
} from '@dabb/shared-types';
import { defaultAIPlayerFactory, type AIPlayer, type AIDifficulty } from './AIPlayer.js';

export interface OfflineGameEngineOptions {
  playerCount: PlayerCount;
  difficulty: AIDifficulty;
  humanPlayerIndex: PlayerIndex;
  existingEvents?: GameEvent[];
}

export interface PersistPayload {
  config: {
    playerCount: PlayerCount;
    difficulty: AIDifficulty;
    humanPlayerIndex: PlayerIndex;
  };
  events: GameEvent[];
  phase: GamePhase;
}

export type StateChangeCallback = (state: GameState, newEvents: GameEvent[]) => void;

// Delay between individual AI card plays within a trick (allows fly-in animation to show)
const AI_CARD_PLAY_DELAY_MS = 700;
// Delay after a trick completes — must cover PAUSE_DURATION (3000ms) + sweep animation (~1000ms) + buffer
const AI_TRICK_COMPLETE_DELAY_MS = 4500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OfflineGameEngine {
  private events: GameEvent[] = [];
  private state!: GameState;
  private sequence = 0;
  private aiPlayers: Map<PlayerIndex, AIPlayer> = new Map();
  private pendingEvents: GameEvent[] = [];

  onStateChange: StateChangeCallback | null = null;

  constructor(private readonly options: OfflineGameEngineOptions) {}

  async start(): Promise<void> {
    if (this.options.existingEvents && this.options.existingEvents.length > 0) {
      this.resume(this.options.existingEvents);
    } else {
      this.initialize();
    }
    await this.runUntilHumanTurn();
    this.flush();
  }

  async dispatch(action: AIAction): Promise<void> {
    if (!this.state) {
      throw new Error('OfflineGameEngine.start() must be called before dispatch()');
    }
    this.applyAction(this.options.humanPlayerIndex, action);
    await this.runUntilHumanTurn();
    this.flush();
  }

  private flush(): void {
    if (this.pendingEvents.length > 0 && this.onStateChange) {
      this.onStateChange(this.state, this.pendingEvents);
      this.pendingEvents = [];
    }
  }

  getViewForPlayer(playerIndex: PlayerIndex): { state: GameState; events: GameEvent[] } {
    const filtered = filterEventsForPlayer(this.events, playerIndex);
    return { state: applyEvents(filtered), events: filtered };
  }

  getPersistPayload(): PersistPayload {
    return {
      config: {
        playerCount: this.options.playerCount,
        difficulty: this.options.difficulty,
        humanPlayerIndex: this.options.humanPlayerIndex,
      },
      events: this.events,
      phase: this.state.phase,
    };
  }

  private ctx() {
    return { sessionId: 'offline', sequence: ++this.sequence };
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
    this.state = applyEvent(this.state, event);
    this.pendingEvents.push(event);
  }

  private createAI(): void {
    this.aiPlayers.clear();
    for (let i = 0; i < this.options.playerCount; i++) {
      if (i !== this.options.humanPlayerIndex) {
        this.aiPlayers.set(
          i as PlayerIndex,
          defaultAIPlayerFactory.create(this.options.difficulty)
        );
      }
    }
  }

  private initialize(): void {
    this.createAI();

    // Seed state so emit() can apply events one at a time
    this.state = createInitialState(this.options.playerCount);

    for (let i = 0; i < this.options.playerCount; i++) {
      this.emit(
        createPlayerJoinedEvent(this.ctx(), uuidv4(), i as PlayerIndex, `Spieler ${i + 1}`)
      );
    }
    this.emit(createGameStartedEvent(this.ctx(), this.options.playerCount, 1000, 0 as PlayerIndex));
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, this.options.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, i) => {
      handsRecord[i as PlayerIndex] = cards;
    });
    this.emit(createCardsDealtEvent(this.ctx(), handsRecord, dabb));
  }

  private resume(existingEvents: GameEvent[]): void {
    this.createAI();
    this.state = applyEvents(existingEvents);
    this.events = [...existingEvents];
    this.sequence = existingEvents.length;
  }

  private whoActsNext(): PlayerIndex | null {
    switch (this.state.phase) {
      case 'bidding':
        return this.state.currentBidder ?? null;
      case 'dabb':
        return this.state.bidWinner ?? null;
      case 'trump':
        return this.state.bidWinner ?? null;
      case 'melding': {
        for (let i = 0; i < this.state.playerCount; i++) {
          const idx = i as PlayerIndex;
          if (!this.state.declaredMelds.has(idx)) {
            if (this.state.wentOut && idx === this.state.bidWinner) {
              continue;
            }
            return idx;
          }
        }
        return null;
      }
      case 'tricks':
        return this.state.currentPlayer ?? null;
      default:
        return null;
    }
  }

  private async runUntilHumanTurn(): Promise<void> {
    while (this.state.phase !== 'finished' && this.state.phase !== 'terminated') {
      const actor = this.whoActsNext();
      if (actor === null || actor === this.options.humanPlayerIndex) {
        return;
      }
      const ai = this.aiPlayers.get(actor)!;
      const action = await ai.decide({
        gameState: this.state,
        playerIndex: actor,
        sessionId: 'offline',
      });

      const isTrickCardPlay = this.state.phase === 'tricks' && action.type === 'playCard';
      const lastCompletedTrickBefore = this.state.lastCompletedTrick;

      this.applyAction(actor, action);

      if (isTrickCardPlay) {
        // Flush immediately so the UI sees this card arrive before the next one
        this.flush();
        const trickJustCompleted = this.state.lastCompletedTrick !== lastCompletedTrickBefore;
        await sleep(trickJustCompleted ? AI_TRICK_COMPLETE_DELAY_MS : AI_CARD_PLAY_DELAY_MS);
      }
    }
  }

  private applyAction(playerIndex: PlayerIndex, action: AIAction): void {
    switch (this.state.phase) {
      case 'bidding':
        this.applyBiddingAction(playerIndex, action);
        break;
      case 'dabb':
        this.applyDabbAction(playerIndex, action);
        break;
      case 'trump':
        this.applyTrumpAction(playerIndex, action);
        break;
      case 'melding':
        this.applyMeldingAction(playerIndex, action);
        break;
      case 'tricks':
        this.applyTricksAction(playerIndex, action);
        break;
      default:
        throw new Error(`applyAction called in unexpected phase: ${this.state.phase}`);
    }
  }

  private applyBiddingAction(playerIndex: PlayerIndex, action: AIAction): void {
    if (action.type === 'bid') {
      this.emit(createBidPlacedEvent(this.ctx(), playerIndex, action.amount));
    } else if (action.type === 'pass') {
      this.emit(createPlayerPassedEvent(this.ctx(), playerIndex));
      if (isBiddingComplete(this.state.playerCount, this.state.passedPlayers)) {
        const winner = getBiddingWinner(this.state.playerCount, this.state.passedPlayers);
        if (winner !== null) {
          this.emit(
            createBiddingWonEvent(this.ctx(), winner, this.state.currentBid || 150, this.state.dabb)
          );
        }
      }
    }
  }

  private applyDabbAction(playerIndex: PlayerIndex, action: AIAction): void {
    switch (action.type) {
      case 'takeDabb':
        this.emit(createDabbTakenEvent(this.ctx(), playerIndex, this.state.dabb));
        break;
      case 'discard':
        this.emit(createCardsDiscardedEvent(this.ctx(), playerIndex, action.cardIds));
        break;
      case 'goOut':
        this.emit(createGoingOutEvent(this.ctx(), playerIndex, action.suit));
        break;
    }
  }

  private applyTrumpAction(playerIndex: PlayerIndex, action: AIAction): void {
    if (action.type === 'declareTrump') {
      this.emit(createTrumpDeclaredEvent(this.ctx(), playerIndex, action.suit));
    }
  }

  private applyMeldingAction(playerIndex: PlayerIndex, action: AIAction): void {
    if (action.type !== 'declareMelds') {
      return;
    }
    const totalPoints = calculateMeldPoints(action.melds);
    this.emit(createMeldsDeclaredEvent(this.ctx(), playerIndex, action.melds, totalPoints));

    const expectedCount = this.state.wentOut ? this.state.playerCount - 1 : this.state.playerCount;

    if (this.state.declaredMelds.size === expectedCount) {
      const meldScores = {} as Record<PlayerIndex, number>;
      this.state.declaredMelds.forEach((melds, idx) => {
        meldScores[idx] = calculateMeldPoints(melds);
      });
      if (this.state.wentOut) {
        meldScores[this.state.bidWinner!] = 0;
      }
      this.emit(createMeldingCompleteEvent(this.ctx(), meldScores));
      if (this.state.wentOut) {
        this.scoreGoingOut(meldScores);
      }
    }
  }

  private applyTricksAction(playerIndex: PlayerIndex, action: AIAction): void {
    if (action.type !== 'playCard') {
      return;
    }
    const hand = this.state.hands.get(playerIndex) || [];
    const card = hand.find((c) => c.id === action.cardId);
    if (!card) {
      throw new Error(`Player ${playerIndex} tried to play card ${action.cardId} not in hand.`);
    }
    this.emit(createCardPlayedEvent(this.ctx(), playerIndex, card));

    if (this.state.currentTrick.cards.length === this.state.playerCount) {
      const winnerIdx = determineTrickWinner(this.state.currentTrick, this.state.trump!);
      const winnerPlayerIndex = this.state.currentTrick.cards[winnerIdx].playerIndex;
      const trickCards = this.state.currentTrick.cards.map((pc) => pc.card);
      const points = calculateTrickPoints(trickCards);
      this.emit(createTrickWonEvent(this.ctx(), winnerPlayerIndex, trickCards, points));

      const allHandsEmpty = Array.from(this.state.hands.values()).every((h) => h.length === 0);
      if (allHandsEmpty) {
        this.scoreRound();
      }
    }
  }

  private scoreGoingOut(meldScores: Record<PlayerIndex, number>): void {
    const bidWinner = this.state.bidWinner!;
    const winningBid = this.state.currentBid || 150;
    const goingOutBonus = 40;

    const scores = {} as Record<
      PlayerIndex | Team,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    >;

    if (this.state.playerCount === 4) {
      const bidWinnerTeam = this.state.players.find((p) => p.playerIndex === bidWinner)!.team!;
      const opponentTeam = (1 - bidWinnerTeam) as Team;
      scores[bidWinnerTeam] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
      const opponentIndices = this.state.players
        .filter((p) => p.team === opponentTeam)
        .map((p) => p.playerIndex);
      const opponentMelds = opponentIndices.reduce(
        (s: number, idx) => s + (meldScores[idx] || 0),
        0
      );
      scores[opponentTeam] = {
        melds: opponentMelds,
        tricks: 0,
        total: opponentMelds + goingOutBonus,
        bidMet: true,
      };
    } else {
      for (let i = 0; i < this.state.playerCount; i++) {
        const idx = i as PlayerIndex;
        if (idx === bidWinner) {
          scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
        } else {
          const melds = meldScores[idx] || 0;
          scores[idx] = { melds, tricks: 0, total: melds + goingOutBonus, bidMet: true };
        }
      }
    }
    this.emitRoundScored(scores);
  }

  private scoreRound(): void {
    const bidWinner = this.state.bidWinner!;
    const winningBid = this.state.currentBid || 150;

    const scores = {} as Record<
      PlayerIndex | Team,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    >;

    if (this.state.playerCount === 4) {
      const playerMelds = new Map<PlayerIndex, number>();
      const playerTricks = new Map<PlayerIndex, number>();
      for (let i = 0; i < 4; i++) {
        const idx = i as PlayerIndex;
        const melds = calculateMeldPoints(this.state.declaredMelds.get(idx) || []);
        const tricksRaw = calculatePlayerTrickRawPoints(
          idx,
          this.state.tricksTaken,
          this.state.lastCompletedTrick?.winnerIndex ?? null
        );
        playerMelds.set(idx, melds);
        playerTricks.set(idx, Math.round(tricksRaw / 10) * 10);
      }
      const bidWinnerTeam = this.state.players.find((p) => p.playerIndex === bidWinner)!.team!;
      for (const team of [0, 1] as Team[]) {
        const indices = this.state.players.filter((p) => p.team === team).map((p) => p.playerIndex);
        const teamMelds = indices.reduce((s: number, idx) => s + playerMelds.get(idx)!, 0);
        const teamTricks = indices.reduce((s: number, idx) => s + playerTricks.get(idx)!, 0);
        const rawTotal = teamMelds + teamTricks;
        const isBidWinnerTeam = team === bidWinnerTeam;
        const bidMet = !isBidWinnerTeam || rawTotal >= winningBid;
        const total = isBidWinnerTeam && !bidMet ? -2 * winningBid : rawTotal;
        scores[team] = { melds: teamMelds, tricks: teamTricks, total, bidMet };
      }
    } else {
      for (let i = 0; i < this.state.playerCount; i++) {
        const idx = i as PlayerIndex;
        const melds = calculateMeldPoints(this.state.declaredMelds.get(idx) || []);
        const tricksRaw = calculatePlayerTrickRawPoints(
          idx,
          this.state.tricksTaken,
          this.state.lastCompletedTrick?.winnerIndex ?? null
        );
        const tricks = Math.round(tricksRaw / 10) * 10;
        const rawTotal = melds + tricks;
        const isBidWinner = idx === bidWinner;
        const bidMet = !isBidWinner || rawTotal >= winningBid;
        const total = isBidWinner && !bidMet ? -2 * winningBid : rawTotal;
        scores[idx] = { melds, tricks, total, bidMet };
      }
    }
    this.emitRoundScored(scores);
  }

  private emitRoundScored(
    scores: Record<
      PlayerIndex | Team,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    >
  ): void {
    const totalScores = {} as Record<PlayerIndex | Team, number>;

    if (this.state.playerCount === 4) {
      for (const team of [0, 1] as Team[]) {
        totalScores[team] = (this.state.totalScores.get(team) ?? 0) + scores[team].total;
      }
    } else {
      for (let i = 0; i < this.state.playerCount; i++) {
        const idx = i as PlayerIndex;
        totalScores[idx] = (this.state.totalScores.get(idx) ?? 0) + scores[idx].total;
      }
    }

    this.emit(createRoundScoredEvent(this.ctx(), scores, totalScores));

    let winner: PlayerIndex | Team | null = null;
    let highestScore = 0;
    if (this.state.playerCount === 4) {
      for (const team of [0, 1] as Team[]) {
        if (totalScores[team] >= this.state.targetScore && totalScores[team] > highestScore) {
          winner = team;
          highestScore = totalScores[team];
        }
      }
    } else {
      for (let i = 0; i < this.state.playerCount; i++) {
        const idx = i as PlayerIndex;
        if (totalScores[idx] >= this.state.targetScore && totalScores[idx] > highestScore) {
          winner = idx;
          highestScore = totalScores[idx];
        }
      }
    }

    if (winner !== null) {
      this.emit(createGameFinishedEvent(this.ctx(), winner, totalScores));
    } else {
      const newDealer = ((this.state.dealer + 1) % this.state.playerCount) as PlayerIndex;
      this.emit(createNewRoundStartedEvent(this.ctx(), this.state.round + 1, newDealer));
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, this.state.playerCount);
      const handsRecord = {} as Record<PlayerIndex, Card[]>;
      hands.forEach((cards, i) => {
        handsRecord[i as PlayerIndex] = cards;
      });
      this.emit(createCardsDealtEvent(this.ctx(), handsRecord, dabb));
      this.createAI();
    }
  }
}
