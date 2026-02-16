/**
 * In-memory game simulation engine for AI-vs-AI games.
 *
 * Runs a complete game without database, server, or Socket.IO —
 * uses pure game-logic functions and BinokelAIPlayer for decisions.
 */

import {
  applyEvent,
  applyEvents,
  calculateMeldPoints,
  calculateTrickPoints,
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDealtEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createDeck,
  createGameFinishedEvent,
  createGameStartedEvent,
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
  shuffleDeck,
} from '@dabb/game-logic';
import type { Card, GameEvent, GameState, PlayerCount, PlayerIndex } from '@dabb/shared-types';

import { BinokelAIPlayer } from '../ai/BinokelAIPlayer.js';

export interface SimulationOptions {
  sessionId: string;
  playerCount: PlayerCount;
  targetScore: number;
  maxActions: number;
  timeoutMs: number;
}

export interface SimulationResult {
  sessionId: string;
  events: GameEvent[];
  rounds: number;
  winner: PlayerIndex | null;
  scores: Record<number, number>;
  actionCount: number;
  durationMs: number;
  error?: string;
  errorStack?: string;
}

const AI_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana'];

export class SimulationEngine {
  private events: GameEvent[] = [];
  private state!: GameState;
  private sequence = 0;
  private aiPlayers: Map<PlayerIndex, BinokelAIPlayer> = new Map();
  private actionCount = 0;

  constructor(private readonly options: SimulationOptions) {}

  private ctx() {
    return { sessionId: this.options.sessionId, sequence: ++this.sequence };
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
    this.state = applyEvent(this.state, event);
  }

  async run(): Promise<SimulationResult> {
    const startTime = Date.now();

    try {
      this.initialize();

      const deadline = startTime + this.options.timeoutMs;

      while (this.state.phase !== 'finished') {
        this.actionCount++;

        if (this.actionCount > this.options.maxActions) {
          throw new Error(
            `Action limit exceeded (${this.options.maxActions}). Phase: ${this.state.phase}, Round: ${this.state.round}`
          );
        }
        if (Date.now() > deadline) {
          throw new Error(
            `Timeout exceeded (${this.options.timeoutMs}ms). Phase: ${this.state.phase}, Round: ${this.state.round}`
          );
        }

        await this.step();
      }

      return this.buildResult(startTime);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return this.buildResult(startTime, error);
    }
  }

  private initialize(): void {
    const { playerCount, targetScore } = this.options;

    // Create AI instances
    for (let i = 0; i < playerCount; i++) {
      this.aiPlayers.set(i as PlayerIndex, new BinokelAIPlayer());
    }

    // Build initialization events
    const initEvents: GameEvent[] = [];
    for (let i = 0; i < playerCount; i++) {
      const idx = i as PlayerIndex;
      initEvents.push(createPlayerJoinedEvent(this.ctx(), `ai-${i}`, idx, AI_NAMES[i]));
    }

    const dealer = 0 as PlayerIndex;
    initEvents.push(createGameStartedEvent(this.ctx(), playerCount, targetScore, dealer));

    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, index) => {
      handsRecord[index as PlayerIndex] = cards;
    });
    initEvents.push(createCardsDealtEvent(this.ctx(), handsRecord, dabb));

    // Apply all init events via applyEvents
    this.state = applyEvents(initEvents);
    this.events.push(...initEvents);
  }

  private async step(): Promise<void> {
    switch (this.state.phase) {
      case 'bidding':
        await this.handleBidding();
        break;
      case 'dabb':
        await this.handleDabb();
        break;
      case 'trump':
        await this.handleTrump();
        break;
      case 'melding':
        await this.handleMelding();
        break;
      case 'tricks':
        await this.handleTricks();
        break;
      default:
        throw new Error(`Unexpected phase: ${this.state.phase}`);
    }
  }

  private getAI(playerIndex: PlayerIndex): BinokelAIPlayer {
    const ai = this.aiPlayers.get(playerIndex);
    if (!ai) {
      throw new Error(`No AI player for index ${playerIndex}`);
    }
    return ai;
  }

  private context(playerIndex: PlayerIndex) {
    return {
      gameState: this.state,
      playerIndex,
      sessionId: this.options.sessionId,
    };
  }

  private async handleBidding(): Promise<void> {
    const playerIndex = this.state.currentBidder!;
    const ai = this.getAI(playerIndex);
    const action = await ai.decide(this.context(playerIndex));

    if (action.type === 'bid') {
      this.emit(createBidPlacedEvent(this.ctx(), playerIndex, action.amount));
    } else if (action.type === 'pass') {
      this.emit(createPlayerPassedEvent(this.ctx(), playerIndex));

      // Check if bidding is complete after pass
      if (isBiddingComplete(this.state.playerCount, this.state.passedPlayers)) {
        const winner = getBiddingWinner(this.state.playerCount, this.state.passedPlayers);
        if (winner !== null) {
          this.emit(createBiddingWonEvent(this.ctx(), winner, this.state.currentBid || 150));
        }
      }
    }
  }

  private async handleDabb(): Promise<void> {
    const playerIndex = this.state.bidWinner!;
    const ai = this.getAI(playerIndex);
    const action = await ai.decide(this.context(playerIndex));

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

  private async handleTrump(): Promise<void> {
    const playerIndex = this.state.bidWinner!;
    const ai = this.getAI(playerIndex);
    const action = await ai.decide(this.context(playerIndex));

    if (action.type === 'declareTrump') {
      this.emit(createTrumpDeclaredEvent(this.ctx(), playerIndex, action.suit));
    }
  }

  private async handleMelding(): Promise<void> {
    // Find first player who hasn't declared melds yet
    let activePlayer: PlayerIndex | null = null;
    for (let i = 0; i < this.state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (!this.state.declaredMelds.has(idx)) {
        if (this.state.wentOut && idx === this.state.bidWinner) {
          continue;
        }
        activePlayer = idx;
        break;
      }
    }

    if (activePlayer === null) {
      return;
    }

    const ai = this.getAI(activePlayer);
    const action = await ai.decide(this.context(activePlayer));

    if (action.type === 'declareMelds') {
      const totalPoints = calculateMeldPoints(action.melds);
      this.emit(createMeldsDeclaredEvent(this.ctx(), activePlayer, action.melds, totalPoints));

      // Check if all players have declared
      const expectedMeldCount = this.state.wentOut
        ? this.state.playerCount - 1
        : this.state.playerCount;

      if (this.state.declaredMelds.size === expectedMeldCount) {
        const meldScores = {} as Record<PlayerIndex, number>;
        this.state.declaredMelds.forEach((melds, idx) => {
          meldScores[idx] = calculateMeldPoints(melds);
        });

        if (this.state.wentOut) {
          const bidWinner = this.state.bidWinner!;
          meldScores[bidWinner] = 0;
        }

        this.emit(createMeldingCompleteEvent(this.ctx(), meldScores));

        if (this.state.wentOut) {
          this.scoreGoingOut(meldScores);
        }
      }
    }
  }

  private async handleTricks(): Promise<void> {
    const playerIndex = this.state.currentPlayer!;
    const ai = this.getAI(playerIndex);
    const action = await ai.decide(this.context(playerIndex));

    if (action.type === 'playCard') {
      const hand = this.state.hands.get(playerIndex) || [];
      const card = hand.find((c) => c.id === action.cardId);
      if (!card) {
        throw new Error(
          `AI tried to play card ${action.cardId} not in hand. Hand: ${hand.map((c) => c.id).join(', ')}`
        );
      }

      this.emit(createCardPlayedEvent(this.ctx(), playerIndex, card));

      // Check if trick is complete
      if (this.state.currentTrick.cards.length === this.state.playerCount) {
        const winnerIdx = determineTrickWinner(this.state.currentTrick, this.state.trump!);
        const winnerPlayerIndex = this.state.currentTrick.cards[winnerIdx].playerIndex;
        const trickCards = this.state.currentTrick.cards.map((pc) => pc.card);
        const points = calculateTrickPoints(trickCards);

        this.emit(createTrickWonEvent(this.ctx(), winnerPlayerIndex, trickCards, points));

        // Check if round is over (all cards played)
        const allHandsEmpty = Array.from(this.state.hands.values()).every((h) => h.length === 0);
        if (allHandsEmpty) {
          this.scoreRound();
        }
      }
    }
  }

  private scoreGoingOut(meldScores: Record<PlayerIndex, number>): void {
    const bidWinner = this.state.bidWinner!;
    const winningBid = this.state.currentBid || 150;
    const goingOutBonus = 40;

    const scores = {} as Record<
      PlayerIndex,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    >;

    for (let i = 0; i < this.state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (idx === bidWinner) {
        scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
      } else {
        const melds = meldScores[idx] || 0;
        scores[idx] = { melds, tricks: 0, total: melds + goingOutBonus, bidMet: true };
      }
    }

    this.emitRoundScored(scores);
  }

  private scoreRound(): void {
    const bidWinner = this.state.bidWinner!;
    const winningBid = this.state.currentBid || 150;

    const scores = {} as Record<
      PlayerIndex,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    >;

    for (let i = 0; i < this.state.playerCount; i++) {
      const idx = i as PlayerIndex;
      const melds = calculateMeldPoints(this.state.declaredMelds.get(idx) || []);
      const tricksCards = this.state.tricksTaken.get(idx) || [];
      const tricksRaw = tricksCards.reduce(
        (sum, trickCards) => sum + calculateTrickPoints(trickCards),
        0
      );
      // Binokel rule: trick points rounded to nearest 10 (5 rounds up)
      const tricks = Math.round(tricksRaw / 10) * 10;
      const rawTotal = melds + tricks;
      const isBidWinner = idx === bidWinner;
      const bidMet = !isBidWinner || rawTotal >= winningBid;
      const total = isBidWinner && !bidMet ? -2 * winningBid : rawTotal;

      scores[idx] = { melds, tricks, total, bidMet };
    }

    this.emitRoundScored(scores);
  }

  private emitRoundScored(
    scores: Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>
  ): void {
    const totalScores = {} as Record<PlayerIndex, number>;
    for (let i = 0; i < this.state.playerCount; i++) {
      const idx = i as PlayerIndex;
      const currentTotal = this.state.totalScores.get(idx) || 0;
      totalScores[idx] = currentTotal + scores[idx].total;
    }

    this.emit(createRoundScoredEvent(this.ctx(), scores, totalScores));

    // Check if game is finished
    let winner: PlayerIndex | null = null;
    let highestScore = 0;

    for (let i = 0; i < this.state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (totalScores[idx] >= this.state.targetScore && totalScores[idx] > highestScore) {
        winner = idx;
        highestScore = totalScores[idx];
      }
    }

    if (winner !== null) {
      this.emit(createGameFinishedEvent(this.ctx(), winner, totalScores));
    } else {
      // Start new round
      const newDealer = ((this.state.dealer + 1) % this.state.playerCount) as PlayerIndex;
      this.emit(createNewRoundStartedEvent(this.ctx(), this.state.round + 1, newDealer));

      // Deal new cards
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, this.state.playerCount);
      const handsRecord = {} as Record<PlayerIndex, Card[]>;
      hands.forEach((cards, index) => {
        handsRecord[index as PlayerIndex] = cards;
      });
      this.emit(createCardsDealtEvent(this.ctx(), handsRecord, dabb));

      // Reset AI instances for new round (clear precomputed trump)
      for (let i = 0; i < this.state.playerCount; i++) {
        this.aiPlayers.set(i as PlayerIndex, new BinokelAIPlayer());
      }
    }
  }

  private buildResult(startTime: number, error?: Error): SimulationResult {
    const scores: Record<number, number> = {};
    for (let i = 0; i < this.options.playerCount; i++) {
      scores[i] = this.state.totalScores.get(i as PlayerIndex) || 0;
    }

    // Find winner from GAME_FINISHED event
    let winner: PlayerIndex | null = null;
    const finishEvent = this.events.find((e) => e.type === 'GAME_FINISHED');
    if (finishEvent && finishEvent.type === 'GAME_FINISHED') {
      winner = finishEvent.payload.winner as PlayerIndex;
    }

    return {
      sessionId: this.options.sessionId,
      events: this.events,
      rounds: this.state.round,
      winner,
      scores,
      actionCount: this.actionCount,
      durationMs: Date.now() - startTime,
      ...(error && { error: error.message, errorStack: error.stack }),
    };
  }
}
