/**
 * In-memory game simulation engine for AI-vs-AI games.
 *
 * Runs a complete game without database or network. The rules come from @dabb/game-logic's
 * engine, the same one the client and offline play use, so a simulated game is scored
 * exactly like a real one. What lives here is the driving loop and its safety limits.
 */

import {
  applyEvent,
  applyEvents,
  createDealEvent,
  createEventsForAction,
  createGameStartedEvent,
  createPlayerJoinedEvent,
  whoActsNext,
} from '@dabb/game-logic';
import type { NextContext } from '@dabb/game-logic';
import type { GameEvent, GameState, PlayerCount, PlayerIndex, Team } from '@dabb/shared-types';
import { AI_NAMES } from '@dabb/shared-types';

import { createAIPlayer, type AIPlayer, type AIDifficulty, type AIStrategy } from '@dabb/game-ai';

export interface SeatConfig {
  difficulty?: AIDifficulty;
  strategy?: AIStrategy;
}

export interface SimulationOptions {
  sessionId: string;
  playerCount: PlayerCount;
  targetScore: number;
  maxActions: number;
  timeoutMs: number;
  /** AI difficulty for all players in the simulation (default: 'medium') */
  difficulty?: AIDifficulty;
  /**
   * Per-seat AI configuration, indexed by seat. Anything left out falls back to `difficulty`
   * and strategy 1, so omitting this entirely keeps the old "same bot in every seat" behaviour.
   *
   * This is what makes a strategy measurable: without it every seat is identical and v1 cannot
   * be played against v2.
   */
  seats?: SeatConfig[];
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
  /** Which strategy sat in which seat, so results can be aggregated by strategy, not by seat. */
  seatStrategies: AIStrategy[];
}

export class SimulationEngine {
  private events: GameEvent[] = [];
  private state!: GameState;
  private sequence = 0;
  private aiPlayers: Map<PlayerIndex, AIPlayer> = new Map();
  private actionCount = 0;
  private seatStrategies: AIStrategy[] = [];

  constructor(private readonly options: SimulationOptions) {}

  private next: NextContext = () => ({
    sessionId: this.options.sessionId,
    sequence: ++this.sequence,
  });

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

    const difficulty = this.options.difficulty ?? 'medium';
    for (let i = 0; i < playerCount; i++) {
      const seat = this.options.seats?.[i];
      this.seatStrategies[i] = seat?.strategy ?? 1;
      // Rubber band off: the simulation measures strategy, and a band that handicaps whoever
      // is ahead would pull every bot-vs-bot game towards a tie and hide exactly that.
      this.aiPlayers.set(
        i as PlayerIndex,
        createAIPlayer(seat?.difficulty ?? difficulty, false, this.seatStrategies[i])
      );
    }

    const initEvents: GameEvent[] = [];
    for (let i = 0; i < playerCount; i++) {
      // 4-player: partners sit opposite each other, so seat parity decides the team
      const team = playerCount === 4 ? ((i % 2) as Team) : undefined;
      initEvents.push(
        createPlayerJoinedEvent(this.next(), `ai-${i}`, i as PlayerIndex, AI_NAMES[i], team)
      );
    }

    initEvents.push(
      createGameStartedEvent(this.next(), playerCount, targetScore, 0 as PlayerIndex)
    );
    initEvents.push(createDealEvent(this.next, playerCount));

    this.state = applyEvents(initEvents);
    this.events.push(...initEvents);
  }

  /**
   * Asks whoever the game is waiting on for their move and applies it.
   *
   * whoActsNext covers the phase-by-phase question of whose turn it is, including melding,
   * where it hands back one undeclared player at a time.
   */
  private async step(): Promise<void> {
    const playerIndex = whoActsNext(this.state);
    if (playerIndex === null) {
      throw new Error(`Nobody to act in phase: ${this.state.phase}`);
    }

    const ai = this.aiPlayers.get(playerIndex);
    if (!ai) {
      throw new Error(`No AI player for index ${playerIndex}`);
    }

    const action = await ai.decide({
      gameState: this.state,
      playerIndex,
      sessionId: this.options.sessionId,
    });

    for (const event of createEventsForAction(this.state, playerIndex, action, this.next)) {
      this.emit(event);
    }
  }

  private buildResult(startTime: number, error?: Error): SimulationResult {
    const scores: Record<number, number> = {};
    this.state.totalScores.forEach((score, key) => {
      scores[key] = score;
    });

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
      seatStrategies: [...this.seatStrategies],
      ...(error && { error: error.message, errorStack: error.stack }),
    };
  }
}
