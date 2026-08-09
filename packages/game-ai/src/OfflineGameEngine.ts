/**
 * OfflineGameEngine — drives a local Dabb game for offline play.
 *
 * The rules live in @dabb/game-logic's engine, same as online play and the simulation.
 * What this class adds is the offline part: it holds the AI players, pauses when it is the
 * human's turn to wait for dispatch(), and paces the AI so their cards are watchable.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  applyEvent,
  applyEvents,
  createDealEvent,
  createEventsForAction,
  createGameStartedEvent,
  createInitialState,
  createPlayerJoinedEvent,
  filterEventsForPlayer,
  whoActsNext,
} from '@dabb/game-logic';
import type { NextContext } from '@dabb/game-logic';
import type {
  AIAction,
  GameEvent,
  GamePhase,
  GameState,
  PlayerCount,
  PlayerIndex,
  Team,
} from '@dabb/shared-types';
import { createAIPlayer, type AIPlayer, type AIDifficulty } from './AIPlayer.js';

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
    await this.act(this.options.humanPlayerIndex, action);
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

  private next: NextContext = () => ({ sessionId: 'offline', sequence: ++this.sequence });

  private emit(event: GameEvent): void {
    this.events.push(event);
    this.state = applyEvent(this.state, event);
    this.pendingEvents.push(event);
  }

  /**
   * Runs one action and paces it. A card play is flushed on its own so the animation layer
   * sees each card arrive before the next player answers.
   */
  private async act(playerIndex: PlayerIndex, action: AIAction): Promise<void> {
    const isTrickCardPlay = this.state.phase === 'tricks' && action.type === 'playCard';
    const lastTrickBefore = this.state.lastCompletedTrick;

    for (const event of createEventsForAction(this.state, playerIndex, action, this.next)) {
      this.emit(event);
    }

    if (!isTrickCardPlay) {
      return;
    }
    this.flush();
    const trickJustCompleted = this.state.lastCompletedTrick !== lastTrickBefore;
    await sleep(trickJustCompleted ? AI_TRICK_COMPLETE_DELAY_MS : AI_CARD_PLAY_DELAY_MS);
  }

  private createAI(): void {
    this.aiPlayers.clear();
    for (let i = 0; i < this.options.playerCount; i++) {
      if (i !== this.options.humanPlayerIndex) {
        this.aiPlayers.set(i as PlayerIndex, createAIPlayer(this.options.difficulty));
      }
    }
  }

  private initialize(): void {
    this.createAI();

    // Seed state so emit() can apply events one at a time
    this.state = createInitialState(this.options.playerCount);

    for (let i = 0; i < this.options.playerCount; i++) {
      // 4-player: partners sit opposite each other, so seat parity decides the team
      const team = this.options.playerCount === 4 ? ((i % 2) as Team) : undefined;
      this.emit(
        createPlayerJoinedEvent(this.next(), uuidv4(), i as PlayerIndex, `Spieler ${i + 1}`, team)
      );
    }
    this.emit(
      createGameStartedEvent(this.next(), this.options.playerCount, 1000, 0 as PlayerIndex)
    );
    this.emit(createDealEvent(this.next, this.options.playerCount));
  }

  private resume(existingEvents: GameEvent[]): void {
    this.createAI();
    this.state = applyEvents(existingEvents);
    this.events = [...existingEvents];
    this.sequence = existingEvents.length;
  }

  private async runUntilHumanTurn(): Promise<void> {
    while (this.state.phase !== 'finished' && this.state.phase !== 'terminated') {
      const actor = whoActsNext(this.state);
      if (actor === null || actor === this.options.humanPlayerIndex) {
        return;
      }
      const ai = this.aiPlayers.get(actor)!;
      const action = await ai.decide({
        gameState: this.state,
        playerIndex: actor,
        sessionId: 'offline',
      });
      await this.act(actor, action);
    }
  }
}
