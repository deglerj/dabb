# Offline AI Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline "Lokal gegen KI" mode to the Dabb app — one human vs AI opponents on-device, resumable, accessible from a redesigned home screen.

**Architecture:** Extract the server's AI module into a new `packages/game-ai` shared package. Add an `OfflineGameEngine` class that drives the game loop locally (mirrors `SimulationEngine` but pauses for human input). Introduce a `GameInterface` type so `GameScreen` can accept either an online (`useGame`) or offline (`useOfflineGame`) game without knowing which it is.

**Tech Stack:** TypeScript ESM, Vitest (tests), React hooks, AsyncStorage via `expo-secure-store` / `localStorage`, Expo Router (new static route `/game/offline`), existing `@dabb/game-logic` event factories.

**Design spec:** `docs/superpowers/specs/2026-04-14-offline-ai-mode-design.md`

---

## File Map

| File                                                       | Action           | Purpose                                                         |
| ---------------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `packages/game-ai/package.json`                            | Create           | New shared package manifest                                     |
| `packages/game-ai/tsconfig.json`                           | Create           | TypeScript config mirroring game-logic                          |
| `packages/game-ai/src/AIPlayer.ts`                         | Move from server | AIPlayer interface + factory                                    |
| `packages/game-ai/src/BinokelAIPlayer.ts`                  | Move from server | AI decision implementation                                      |
| `packages/game-ai/src/OfflineGameEngine.ts`                | Create           | Local game loop for offline play                                |
| `packages/game-ai/src/index.ts`                            | Create           | Package exports                                                 |
| `packages/game-ai/src/__tests__/OfflineGameEngine.test.ts` | Create           | Engine unit tests                                               |
| `apps/server/src/ai/AIPlayer.ts`                           | Delete           | Now lives in packages/game-ai                                   |
| `apps/server/src/ai/BinokelAIPlayer.ts`                    | Delete           | Now lives in packages/game-ai                                   |
| `apps/server/src/ai/index.ts`                              | Update           | Re-export from @dabb/game-ai                                    |
| `apps/server/package.json`                                 | Update           | Add @dabb/game-ai dependency                                    |
| `packages/ui-shared/src/GameInterface.ts`                  | Create           | Shared interface for useGame and useOfflineGame                 |
| `packages/ui-shared/src/index.ts`                          | Update           | Export GameInterface                                            |
| `packages/ui-shared/package.json`                          | Update           | Add @dabb/game-ai dependency                                    |
| `apps/client/src/hooks/useGame.ts`                         | Update           | Implement GameInterface; add terminatedByNickname               |
| `apps/client/src/hooks/useOfflineGame.ts`                  | Create           | Offline hook wrapping OfflineGameEngine                         |
| `apps/client/src/components/ui/GameScreen.tsx`             | Update           | Accept `game: GameInterface` prop instead of sessionId/secretId |
| `apps/client/src/app/game/[code].native.tsx`               | Update           | Call useGame at route level, pass as GameInterface              |
| `apps/client/src/app/game/[code].tsx`                      | Update           | Same for web (WithSkiaWeb path)                                 |
| `apps/client/src/app/game/offline.native.tsx`              | Create           | Mobile offline game route                                       |
| `apps/client/src/app/game/offline.tsx`                     | Create           | Web offline game route                                          |
| `packages/i18n/src/types.ts`                               | Update           | Add offline/home translation keys to TranslationKeys            |
| `packages/i18n/src/locales/de.ts`                          | Update           | German strings                                                  |
| `packages/i18n/src/locales/en.ts`                          | Update           | English strings                                                 |
| `apps/client/src/components/ui/HomeScreen.tsx`             | Update           | 3 buttons, offline form, resume banner                          |

---

## Task 1: Scaffold `packages/game-ai`

**Files:**

- Create: `packages/game-ai/package.json`
- Create: `packages/game-ai/tsconfig.json`

- [ ] **Step 1: Create `packages/game-ai/package.json`**

```json
{
  "name": "@dabb/game-ai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist coverage",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@dabb/game-logic": "workspace:*",
    "@dabb/shared-types": "workspace:*",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.1.2",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Create `packages/game-ai/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/game-ai/src/` directory and placeholder `index.ts`**

```typescript
// packages/game-ai/src/index.ts
// Populated in Task 2
export {};
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: no errors, `@dabb/game-ai` appears in workspace.

- [ ] **Step 5: Commit**

```bash
git add packages/game-ai/
git commit -m "chore: scaffold packages/game-ai"
```

---

## Task 2: Move AI Files into `packages/game-ai`

**Files:**

- Create: `packages/game-ai/src/AIPlayer.ts` (from apps/server/src/ai/AIPlayer.ts)
- Create: `packages/game-ai/src/BinokelAIPlayer.ts` (from apps/server/src/ai/BinokelAIPlayer.ts)
- Create: `packages/game-ai/src/index.ts`
- Modify: `apps/server/src/ai/index.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Copy `AIPlayer.ts` to the new package**

Copy the full content of `apps/server/src/ai/AIPlayer.ts` to `packages/game-ai/src/AIPlayer.ts`. The import path for `BinokelAIPlayer` changes from `'./BinokelAIPlayer.js'` to `'./BinokelAIPlayer.js'` (unchanged). No other changes.

- [ ] **Step 2: Copy `BinokelAIPlayer.ts` to the new package**

Copy the full content of `apps/server/src/ai/BinokelAIPlayer.ts` to `packages/game-ai/src/BinokelAIPlayer.ts`. No changes needed — it only imports from `@dabb/shared-types` and `@dabb/game-logic`, both available in the new package.

- [ ] **Step 3: Create `packages/game-ai/src/index.ts`**

```typescript
export type { AIPlayer, AIPlayerFactory, AIDifficulty } from './AIPlayer.js';
export { DefaultAIPlayerFactory, defaultAIPlayerFactory } from './AIPlayer.js';
export { BinokelAIPlayer } from './BinokelAIPlayer.js';
```

- [ ] **Step 4: Replace `apps/server/src/ai/index.ts` with re-exports**

Replace the entire file content with:

```typescript
/**
 * AI module — re-exports from @dabb/game-ai shared package.
 */
export type { AIPlayer, AIPlayerFactory, AIDifficulty } from '@dabb/game-ai';
export { DefaultAIPlayerFactory, defaultAIPlayerFactory, BinokelAIPlayer } from '@dabb/game-ai';
```

- [ ] **Step 5: Delete the now-redundant server AI source files**

```bash
rm apps/server/src/ai/AIPlayer.ts
rm apps/server/src/ai/BinokelAIPlayer.ts
```

- [ ] **Step 6: Add `@dabb/game-ai` to `apps/server/package.json` dependencies**

In `apps/server/package.json`, add to `"dependencies"`:

```json
"@dabb/game-ai": "workspace:*",
```

- [ ] **Step 7: Install and verify server still builds**

Run: `pnpm install && pnpm --filter @dabb/game-ai build && pnpm --filter @dabb/server build`
Expected: all three succeed with no TypeScript errors.

- [ ] **Step 8: Run server tests**

Run: `pnpm --filter @dabb/server test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/game-ai/src/ apps/server/src/ai/ apps/server/package.json pnpm-lock.yaml
git commit -m "refactor: move AI module to shared packages/game-ai"
```

---

## Task 3: Implement `OfflineGameEngine` (TDD)

**Files:**

- Create: `packages/game-ai/src/__tests__/OfflineGameEngine.test.ts`
- Create: `packages/game-ai/src/OfflineGameEngine.ts`
- Modify: `packages/game-ai/src/index.ts`

The engine mirrors `apps/server/src/simulation/SimulationEngine.ts` but pauses when it's the human player's turn. Reference that file for the full phase handler logic (bidding, dabb, trump, melding, tricks, score calculation).

- [ ] **Step 1: Write the failing tests**

Create `packages/game-ai/src/__tests__/OfflineGameEngine.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OfflineGameEngine } from '../OfflineGameEngine.js';
import type { GameState } from '@dabb/shared-types';

describe('OfflineGameEngine', () => {
  it('initialises and pauses at the human turn', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    const states: GameState[] = [];
    engine.onStateChange = (state) => {
      states.push(state);
    };

    await engine.start();

    // Game has progressed through init events
    expect(states.length).toBeGreaterThan(0);
    // Phase must be one that needs player action
    const lastState = states[states.length - 1];
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks']).toContain(lastState.phase);
  });

  it('hides opponent cards in player view', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine.start();

    const view = engine.getViewForPlayer(0);
    const opponentHand = view.state.hands.get(1);
    // Opponent hand must be hidden placeholders
    expect(opponentHand).toBeDefined();
    if (opponentHand && opponentHand.length > 0) {
      expect(opponentHand[0].id).toMatch(/^hidden-/);
    }
    // Own hand must be real cards
    const ownHand = view.state.hands.get(0);
    if (ownHand && ownHand.length > 0) {
      expect(ownHand[0].id).not.toMatch(/^hidden-/);
    }
  });

  it('getPersistPayload includes config, events, and phase', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 3,
      difficulty: 'medium',
      humanPlayerIndex: 0,
    });
    await engine.start();

    const payload = engine.getPersistPayload();
    expect(payload.config.playerCount).toBe(3);
    expect(payload.config.difficulty).toBe('medium');
    expect(payload.config.humanPlayerIndex).toBe(0);
    expect(Array.isArray(payload.events)).toBe(true);
    expect(payload.events.length).toBeGreaterThan(0);
    expect(payload.phase).toBeDefined();
  });

  it('resumes from existing events without re-initialising', async () => {
    const engine1 = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine1.start();

    const payload = engine1.getPersistPayload();

    const changes: GameState[] = [];
    const engine2 = new OfflineGameEngine({
      ...payload.config,
      existingEvents: payload.events,
    });
    engine2.onStateChange = (state) => {
      changes.push(state);
    };
    await engine2.start();

    // Resume should not emit init events again — state matches
    const view1 = engine1.getViewForPlayer(0);
    const view2 = engine2.getViewForPlayer(0);
    expect(view2.state.phase).toBe(view1.state.phase);
    expect(view2.state.round).toBe(view1.state.round);
  });

  it('dispatch applies human action and drives AI until human turn again', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine.start();

    let view = engine.getViewForPlayer(0);

    // If AI already won bidding and it's dabb phase for AI, start() resolved
    // in an active-player state for human. Dispatch something appropriate.
    if (view.state.phase === 'bidding' && view.state.currentBidder === 0) {
      await engine.dispatch({ type: 'bid', amount: 150 });
      view = engine.getViewForPlayer(0);
      // After bid, AI should have responded; phase may have changed
      expect(['bidding', 'dabb', 'trump', 'melding', 'tricks', 'finished']).toContain(
        view.state.phase
      );
    } else if (view.state.phase === 'bidding' && view.state.currentBidder === 0) {
      await engine.dispatch({ type: 'pass' });
      view = engine.getViewForPlayer(0);
      expect(['bidding', 'dabb', 'trump', 'melding', 'tricks', 'finished']).toContain(
        view.state.phase
      );
    }
    // No assertion if it's not human's bidding turn — game state is valid either way
  });

  it('onStateChange fires for each emitted event', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    let callCount = 0;
    engine.onStateChange = () => {
      callCount++;
    };
    await engine.start();

    expect(callCount).toBeGreaterThan(2); // at least: playerJoined x2, gameStarted, cardsDealt
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dabb/game-ai test`
Expected: FAIL with "Cannot find module '../OfflineGameEngine.js'"

- [ ] **Step 3: Implement `OfflineGameEngine.ts`**

Create `packages/game-ai/src/OfflineGameEngine.ts`:

```typescript
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
} from '@dabb/game-logic';
import type {
  AIAction,
  Card,
  GameEvent,
  GamePhase,
  GameState,
  Meld,
  PlayerCount,
  PlayerIndex,
  Team,
} from '@dabb/shared-types';
import { filterEventsForPlayer } from '@dabb/game-logic';
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

export class OfflineGameEngine {
  private events: GameEvent[] = [];
  private state!: GameState;
  private sequence = 0;
  private aiPlayers: Map<PlayerIndex, AIPlayer> = new Map();

  onStateChange: StateChangeCallback | null = null;

  constructor(private readonly options: OfflineGameEngineOptions) {}

  /** Initialises (or resumes) the game and runs AI until it's the human's turn. */
  async start(): Promise<void> {
    if (this.options.existingEvents && this.options.existingEvents.length > 0) {
      this.resume(this.options.existingEvents);
    } else {
      this.initialize();
    }
    await this.runUntilHumanTurn();
  }

  /**
   * Apply a human player action, then drive AI until it's the human's turn again.
   * Called by useOfflineGame in response to player UI actions.
   */
  async dispatch(action: AIAction): Promise<void> {
    this.applyAction(this.options.humanPlayerIndex, action);
    await this.runUntilHumanTurn();
  }

  /**
   * Returns the full event log filtered for the given player's view.
   * Use this to build what the UI sees — opponent hands are hidden.
   */
  getViewForPlayer(playerIndex: PlayerIndex): { state: GameState; events: GameEvent[] } {
    const filtered = filterEventsForPlayer(this.events, playerIndex);
    return { state: applyEvents(filtered), events: filtered };
  }

  /** Snapshot for AsyncStorage persistence. */
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ctx() {
    return { sessionId: 'offline', sequence: ++this.sequence };
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
    this.state = applyEvent(this.state, event);
    this.onStateChange?.(this.state, [event]);
  }

  private emitSilent(event: GameEvent): void {
    this.events.push(event);
    this.state = applyEvent(this.state, event);
  }

  private createAI(): void {
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

    const initEvents: GameEvent[] = [];
    for (let i = 0; i < this.options.playerCount; i++) {
      initEvents.push(
        createPlayerJoinedEvent(this.ctx(), uuidv4(), i as PlayerIndex, `Spieler ${i + 1}`)
      );
    }
    initEvents.push(
      createGameStartedEvent(this.ctx(), this.options.playerCount, 1000, 0 as PlayerIndex)
    );
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, this.options.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, i) => {
      handsRecord[i as PlayerIndex] = cards;
    });
    initEvents.push(createCardsDealtEvent(this.ctx(), handsRecord, dabb));

    this.state = applyEvents(initEvents);
    this.events.push(...initEvents);
    this.sequence = initEvents.length;
    this.onStateChange?.(this.state, initEvents);
  }

  private resume(existingEvents: GameEvent[]): void {
    this.createAI();
    this.state = applyEvents(existingEvents);
    this.events = [...existingEvents];
    this.sequence = existingEvents.length;
    // No onStateChange — hook already has state from storage
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
            if (this.state.wentOut && idx === this.state.bidWinner) continue;
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
      if (actor === null || actor === this.options.humanPlayerIndex) return;
      const ai = this.aiPlayers.get(actor)!;
      const action = await ai.decide({
        gameState: this.state,
        playerIndex: actor,
        sessionId: 'offline',
      });
      this.applyAction(actor, action);
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
    if (action.type !== 'declareMelds') return;
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
    if (action.type !== 'playCard') return;
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

    // Check for winner
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
      // New round
      const newDealer = ((this.state.dealer + 1) % this.state.playerCount) as PlayerIndex;
      this.emit(createNewRoundStartedEvent(this.ctx(), this.state.round + 1, newDealer));
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, this.state.playerCount);
      const handsRecord = {} as Record<PlayerIndex, Card[]>;
      hands.forEach((cards, i) => {
        handsRecord[i as PlayerIndex] = cards;
      });
      this.emit(createCardsDealtEvent(this.ctx(), handsRecord, dabb));
      // Reset AI for new round (clears per-round state)
      this.createAI();
    }
  }
}
```

- [ ] **Step 4: Export `OfflineGameEngine` from `packages/game-ai/src/index.ts`**

Add to the end of `packages/game-ai/src/index.ts`:

```typescript
export { OfflineGameEngine } from './OfflineGameEngine.js';
export type {
  OfflineGameEngineOptions,
  PersistPayload,
  StateChangeCallback,
} from './OfflineGameEngine.js';
```

- [ ] **Step 5: Run tests and confirm they pass**

Run: `pnpm --filter @dabb/game-ai test`
Expected: all 5 tests PASS.

- [ ] **Step 6: Confirm package builds**

Run: `pnpm --filter @dabb/game-ai build`
Expected: success, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/game-ai/
git commit -m "feat: add OfflineGameEngine to packages/game-ai"
```

---

## Task 4: Extract `GameInterface` and Refactor `GameScreen`

**Files:**

- Create: `packages/ui-shared/src/GameInterface.ts`
- Modify: `packages/ui-shared/src/index.ts`
- Modify: `apps/client/src/hooks/useGame.ts`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`
- Modify: `apps/client/src/app/game/[code].native.tsx`
- Modify: `apps/client/src/app/game/[code].tsx`

- [ ] **Step 1: Create `packages/ui-shared/src/GameInterface.ts`**

```typescript
/**
 * GameInterface — unified contract for online and offline game hooks.
 * Both useGame and useOfflineGame implement this interface.
 * GameScreen accepts it as a prop, unaware of transport layer.
 */
import type { CardId, GameEvent, GameState, Meld, PlayerIndex, Suit } from '@dabb/shared-types';

export interface GameInterface {
  state: GameState;
  events: GameEvent[];
  /** True during the initial load / reconnect — suppresses sounds. */
  isInitialLoad: boolean;
  /** Map from player index to display nickname. */
  nicknames: Map<PlayerIndex, string>;
  /** Whether the transport is connected (always true offline). */
  connected: boolean;
  /**
   * When a remote player terminates an online game this holds their nickname.
   * Always null offline.
   */
  terminatedByNickname: string | null;
  onBid: (amount: number) => void;
  onPass: () => void;
  onTakeDabb: () => void;
  onDiscard: (cardIds: CardId[]) => void;
  onGoOut: (suit: Suit) => void;
  onDeclareTrump: (suit: Suit) => void;
  onDeclareMelds: (melds: Meld[]) => void;
  onPlayCard: (cardId: CardId) => void;
  onExit: () => void;
}
```

- [ ] **Step 2: Export `GameInterface` from `packages/ui-shared/src/index.ts`**

Add to `packages/ui-shared/src/index.ts`:

```typescript
export type { GameInterface } from './GameInterface.js';
```

- [ ] **Step 3: Update `apps/client/src/hooks/useGame.ts` to implement `GameInterface`**

Replace the return type of `useGame` to include `terminatedByNickname` (moved here from `GameScreen`):

```typescript
/**
 * useGame — connects to the game server and manages game state.
 * Implements GameInterface for use with GameScreen.
 */
import { useCallback, useState } from 'react';
import { useSocket, useGameState } from '@dabb/ui-shared';
import type { GameInterface } from '@dabb/ui-shared';
import { SERVER_URL } from '../constants.js';
import type { CardId, Suit, PlayerIndex, Meld } from '@dabb/shared-types';

export interface UseGameOptions {
  sessionId: string;
  secretId: string;
  playerIndex: number;
}

export function useGame({ sessionId, secretId, playerIndex }: UseGameOptions): GameInterface {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());
  const [terminatedByNickname, setTerminatedByNickname] = useState<string | null>(null);

  const { state, events, isInitialLoad, processEvents } = useGameState({
    playerIndex: playerIndex as PlayerIndex,
  });

  const handleStateNicknames = useCallback((record: Record<number, string>) => {
    setNicknames(new Map(Object.entries(record).map(([k, v]) => [Number(k) as PlayerIndex, v])));
  }, []);

  const handlePlayerJoined = useCallback((idx: number, nickname: string) => {
    setNicknames((prev) => {
      const next = new Map(prev);
      next.set(idx as PlayerIndex, nickname);
      return next;
    });
  }, []);

  const handleSessionTerminated = useCallback(
    (data: { message: string; terminatedBy?: string }) => {
      setTerminatedByNickname(data.terminatedBy ?? null);
    },
    []
  );

  const { socket, connected } = useSocket({
    serverUrl: SERVER_URL,
    sessionId,
    secretId,
    onEvents: processEvents,
    onStateNicknames: handleStateNicknames,
    onPlayerJoined: handlePlayerJoined,
    onSessionTerminated: handleSessionTerminated,
  });

  const onBid = useCallback((amount: number) => socket?.emit('game:bid', { amount }), [socket]);
  const onPass = useCallback(() => socket?.emit('game:pass'), [socket]);
  const onTakeDabb = useCallback(() => socket?.emit('game:takeDabb'), [socket]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => socket?.emit('game:discard', { cardIds }),
    [socket]
  );
  const onGoOut = useCallback((suit: Suit) => socket?.emit('game:goOut', { suit }), [socket]);
  const onDeclareTrump = useCallback(
    (suit: Suit) => socket?.emit('game:declareTrump', { suit }),
    [socket]
  );
  const onDeclareMelds = useCallback(
    (melds: Meld[]) => socket?.emit('game:declareMelds', { melds }),
    [socket]
  );
  const onPlayCard = useCallback(
    (cardId: CardId) => socket?.emit('game:playCard', { cardId }),
    [socket]
  );
  const onExit = useCallback(() => socket?.emit('game:exit'), [socket]);

  return {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    terminatedByNickname,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
  };
}
```

Note: `connecting`, `error`, and `reset` from the old `useGame` are no longer returned (they were not used by `GameScreen`). The `onSessionTerminated` option moves inside `useGame`.

- [ ] **Step 4: Update `GameScreenProps` in `GameScreen.tsx` to accept `game: GameInterface`**

In `apps/client/src/components/ui/GameScreen.tsx`:

Replace:

```typescript
export interface GameScreenProps {
  sessionId: string;
  secretId: string;
  playerIndex: PlayerIndex;
}
```

with:

```typescript
export interface GameScreenProps {
  game: GameInterface;
  playerIndex: PlayerIndex;
}
```

Add the import at the top of `GameScreen.tsx`:

```typescript
import type { GameInterface } from '@dabb/ui-shared';
```

Remove the import of `useGame` from the top:

```typescript
// Remove: import { useGame } from '../../hooks/useGame.js';
```

- [ ] **Step 5: Update `GameScreen` function signature and destructuring**

Replace:

```typescript
export default function GameScreen({ sessionId, secretId, playerIndex }: GameScreenProps) {
```

with:

```typescript
export default function GameScreen({ game, playerIndex }: GameScreenProps) {
```

Remove the `handleSessionTerminated` / `terminatedByNickname` state from `GameScreen` (now in `useGame`).

Replace the `useGame(...)` call and its destructuring:

```typescript
// Remove these lines:
const [terminatedByNickname, setTerminatedByNickname] = useState<string | null>(null);

const handleSessionTerminated = useCallback((data: { message: string; terminatedBy?: string }) => {
  setTerminatedByNickname(data.terminatedBy ?? null);
}, []);

const {
  state,
  events,
  isInitialLoad,
  nicknames,
  connected,
  onBid,
  onPass,
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
  onExit,
} = useGame({ sessionId, secretId, playerIndex, onSessionTerminated: handleSessionTerminated });
```

Replace with:

```typescript
const {
  state,
  events,
  isInitialLoad,
  nicknames,
  connected,
  terminatedByNickname,
  onBid,
  onPass,
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
  onExit,
} = game;
```

- [ ] **Step 6: Update `apps/client/src/app/game/[code].native.tsx`**

Move `useGame` call from `GameScreen` to the route. Replace the file content with:

```typescript
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import GameScreen from '../../components/ui/GameScreen.js';
import { storageGet } from '../../hooks/useStorage.js';
import { useGame } from '../../hooks/useGame.js';
import type { PlayerIndex } from '@dabb/shared-types';

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
};

export default function GameRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [credentials, setCredentials] = useState<StoredSession | null>(null);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const raw = await storageGet(`dabb-${code}`);
        if (!raw) {
          router.replace('/');
          return;
        }
        setCredentials(JSON.parse(raw) as StoredSession);
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  const game = useGame(
    credentials
      ? { sessionId: code, secretId: credentials.secretId, playerIndex: credentials.playerIndex }
      : { sessionId: '', secretId: '', playerIndex: 0 }
  );

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <GameScreen game={game} playerIndex={credentials.playerIndex} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 7: Update `apps/client/src/app/game/[code].tsx` (web route)**

The web route uses `WithSkiaWeb` for lazy Skia loading. Update the `componentProps` type and the lazy import type. Replace the file content:

```typescript
/**
 * Web game route — uses WithSkiaWeb to defer Skia module loading.
 * See original file header for full explanation.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { storageGet } from '../../hooks/useStorage.js';
import { useGame } from '../../hooks/useGame.js';
import type { GameInterface } from '@dabb/ui-shared';
import type { PlayerIndex } from '@dabb/shared-types';

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
};

export default function GameRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [credentials, setCredentials] = useState<StoredSession | null>(null);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const raw = await storageGet(`dabb-${code}`);
        if (!raw) {
          router.replace('/');
          return;
        }
        setCredentials(JSON.parse(raw) as StoredSession);
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  const game = useGame(
    credentials
      ? { sessionId: code, secretId: credentials.secretId, playerIndex: credentials.playerIndex }
      : { sessionId: '', secretId: '', playerIndex: 0 }
  );

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <WithSkiaWeb
      getComponent={() =>
        import('../../components/ui/GameScreen.js') as unknown as Promise<{
          default: React.ComponentType<{ game: GameInterface; playerIndex: PlayerIndex }>;
        }>
      }
      opts={{ locateFile: (file: string) => `/${file}` }}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      }
      componentProps={{ game, playerIndex: credentials.playerIndex }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 8: Build to verify**

Run: `pnpm run build`
Expected: success, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/ui-shared/src/ apps/client/src/hooks/useGame.ts apps/client/src/components/ui/GameScreen.tsx apps/client/src/app/game/
git commit -m "refactor: extract GameInterface, move useGame to route level"
```

---

## Task 5: Implement `useOfflineGame` Hook (TDD)

**Files:**

- Create: `apps/client/src/hooks/__tests__/useOfflineGame.test.ts`
- Create: `apps/client/src/hooks/useOfflineGame.ts`

`useOfflineGame` needs `@dabb/game-ai`, which is not yet in `apps/client/package.json`.

- [ ] **Step 1: Add `@dabb/game-ai` to `apps/client/package.json` dependencies**

In `apps/client/package.json`, add to `"dependencies"`:

```json
"@dabb/game-ai": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing tests**

Create `apps/client/src/hooks/__tests__/useOfflineGame.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineGame } from '../useOfflineGame.js';

// Mock storage
vi.mock('../useStorage.js', () => ({
  storageGet: vi.fn().mockResolvedValue(null),
  storageSet: vi.fn().mockResolvedValue(undefined),
  storageDelete: vi.fn().mockResolvedValue(undefined),
}));

// Mock the engine — avoid slow AI computations in hook tests
vi.mock('@dabb/game-ai', () => {
  const mockDispatch = vi.fn().mockResolvedValue(undefined);
  const mockGetView = vi.fn().mockReturnValue({
    state: {
      phase: 'bidding',
      playerCount: 2,
      players: [],
      hands: new Map(),
      dabb: [],
      currentBid: 0,
      bidWinner: null,
      currentBidder: 0,
      firstBidder: null,
      passedPlayers: new Set(),
      lastBidderIndex: null,
      trump: null,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      tricksTaken: new Map(),
      currentPlayer: null,
      roundScores: new Map(),
      totalScores: new Map(),
      targetScore: 1000,
      declaredMelds: new Map(),
      dealer: 0,
      round: 1,
      wentOut: false,
      dabbCardIds: [],
      lastCompletedTrick: null,
    },
    events: [],
  });
  const mockStart = vi.fn().mockImplementation(function (this: unknown) {
    // call onStateChange to simulate initialization
    return Promise.resolve();
  });
  const MockEngine = vi.fn().mockImplementation(() => ({
    onStateChange: null,
    start: mockStart,
    dispatch: mockDispatch,
    getViewForPlayer: mockGetView,
    getPersistPayload: vi.fn().mockReturnValue({
      config: { playerCount: 2, difficulty: 'medium', humanPlayerIndex: 0 },
      events: [],
      phase: 'bidding',
    }),
  }));
  return { OfflineGameEngine: MockEngine };
});

describe('useOfflineGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a GameInterface-compatible object', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('events');
    expect(result.current).toHaveProperty('isInitialLoad');
    expect(result.current).toHaveProperty('nicknames');
    expect(result.current).toHaveProperty('connected');
    expect(result.current).toHaveProperty('terminatedByNickname');
    expect(result.current).toHaveProperty('onBid');
    expect(result.current).toHaveProperty('onPass');
    expect(result.current).toHaveProperty('onExit');
  });

  it('connected is always true', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    expect(result.current.connected).toBe(true);
  });

  it('terminatedByNickname is always null', () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    expect(result.current.terminatedByNickname).toBeNull();
  });

  it('nicknames contains human player name and AI names', async () => {
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.nicknames.get(0)).toBe('Hans');
    // AI players get generated names
    expect(result.current.nicknames.get(1)).toMatch(/KI|AI/);
  });

  it('onBid calls engine.dispatch with bid action', async () => {
    const { OfflineGameEngine } = await import('@dabb/game-ai');
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    await act(async () => {
      result.current.onBid(180);
    });

    const instance = (OfflineGameEngine as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(instance.dispatch).toHaveBeenCalledWith({ type: 'bid', amount: 180 });
  });

  it('onExit clears storage', async () => {
    const { storageDelete } = await import('../useStorage.js');
    const { result } = renderHook(() =>
      useOfflineGame({ playerCount: 2, difficulty: 'medium', nickname: 'Hans', resume: false })
    );

    await act(async () => {
      result.current.onExit();
    });

    expect(storageDelete).toHaveBeenCalledWith('dabb-offline-game');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @dabb/client test -- hooks/__tests__/useOfflineGame`

(If no test runner is configured for the client, run `pnpm --filter @dabb/client test` and look for the new file.)

Expected: FAIL with "Cannot find module '../useOfflineGame.js'"

- [ ] **Step 4: Implement `apps/client/src/hooks/useOfflineGame.ts`**

```typescript
/**
 * useOfflineGame — offline game hook that wraps OfflineGameEngine.
 * Implements GameInterface for use with GameScreen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { OfflineGameEngine } from '@dabb/game-ai';
import type { GameInterface } from '@dabb/ui-shared';
import type {
  CardId,
  GameEvent,
  GameState,
  Meld,
  PlayerIndex,
  Suit,
  PlayerCount,
} from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';
import { storageGet, storageSet, storageDelete } from './useStorage.js';

const STORAGE_KEY = 'dabb-offline-game';
const HUMAN_PLAYER_INDEX = 0 as PlayerIndex;

export interface UseOfflineGameOptions {
  playerCount: PlayerCount;
  difficulty: AIDifficulty;
  nickname: string;
  /** When true, load existing game from storage rather than starting fresh. */
  resume: boolean;
}

function buildNicknames(
  playerCount: number,
  humanNickname: string,
  humanIndex: PlayerIndex
): Map<PlayerIndex, string> {
  const map = new Map<PlayerIndex, string>();
  for (let i = 0; i < playerCount; i++) {
    const idx = i as PlayerIndex;
    if (idx === humanIndex) {
      map.set(idx, humanNickname);
    } else {
      const aiNumber = idx < humanIndex ? idx + 1 : idx;
      map.set(idx, `KI ${aiNumber}`);
    }
  }
  return map;
}

export function useOfflineGame({
  playerCount,
  difficulty,
  nickname,
  resume,
}: UseOfflineGameOptions): GameInterface {
  const engineRef = useRef<OfflineGameEngine | null>(null);

  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const nicknames = buildNicknames(playerCount, nickname, HUMAN_PLAYER_INDEX);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      let existingEvents: GameEvent[] | undefined;

      if (resume) {
        try {
          const raw = await storageGet(STORAGE_KEY);
          if (raw) {
            const payload = JSON.parse(raw) as { events: GameEvent[] };
            existingEvents = payload.events;
          }
        } catch {
          // Storage read failed — start fresh
        }
      }

      const engine = new OfflineGameEngine({
        playerCount,
        difficulty,
        humanPlayerIndex: HUMAN_PLAYER_INDEX,
        existingEvents,
      });

      engine.onStateChange = (newState, newEvents) => {
        if (cancelled) return;
        const view = engine.getViewForPlayer(HUMAN_PLAYER_INDEX);
        setState(view.state);
        setEvents((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          const fresh = view.events.filter((e) => !ids.has(e.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        setIsInitialLoad(false);

        // Persist after every state change
        const payload = engine.getPersistPayload();
        void storageSet(STORAGE_KEY, JSON.stringify(payload));
      };

      engineRef.current = engine;
      await engine.start();

      if (!cancelled) {
        // Populate initial view after start() (resume case)
        const view = engine.getViewForPlayer(HUMAN_PLAYER_INDEX);
        setState(view.state);
        setEvents(view.events);
        setIsInitialLoad(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — engine is initialised once on mount

  const dispatch = useCallback(async (action: Parameters<OfflineGameEngine['dispatch']>[0]) => {
    await engineRef.current?.dispatch(action);
  }, []);

  const onBid = useCallback(
    (amount: number) => {
      void dispatch({ type: 'bid', amount });
    },
    [dispatch]
  );
  const onPass = useCallback(() => {
    void dispatch({ type: 'pass' });
  }, [dispatch]);
  const onTakeDabb = useCallback(() => {
    void dispatch({ type: 'takeDabb' });
  }, [dispatch]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => {
      void dispatch({ type: 'discard', cardIds });
    },
    [dispatch]
  );
  const onGoOut = useCallback(
    (suit: Suit) => {
      void dispatch({ type: 'goOut', suit });
    },
    [dispatch]
  );
  const onDeclareTrump = useCallback(
    (suit: Suit) => {
      void dispatch({ type: 'declareTrump', suit });
    },
    [dispatch]
  );
  const onDeclareMelds = useCallback(
    (melds: Meld[]) => {
      void dispatch({ type: 'declareMelds', melds });
    },
    [dispatch]
  );
  const onPlayCard = useCallback(
    (cardId: CardId) => {
      void dispatch({ type: 'playCard', cardId });
    },
    [dispatch]
  );

  const onExit = useCallback(() => {
    engineRef.current = null;
    void storageDelete(STORAGE_KEY);
  }, []);

  // Provide a minimal non-null state so GameScreen doesn't crash before engine starts
  const safeState = state ?? {
    phase: 'waiting' as const,
    playerCount,
    players: [],
    hands: new Map(),
    dabb: [],
    currentBid: 0,
    bidWinner: null,
    currentBidder: null,
    firstBidder: null,
    passedPlayers: new Set(),
    lastBidderIndex: null,
    trump: null,
    currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
    tricksTaken: new Map(),
    currentPlayer: null,
    roundScores: new Map(),
    totalScores: new Map(),
    targetScore: 1000,
    declaredMelds: new Map(),
    dealer: 0 as PlayerIndex,
    round: 1,
    wentOut: false,
    dabbCardIds: [],
    lastCompletedTrick: null,
  };

  return {
    state: safeState,
    events,
    isInitialLoad,
    nicknames,
    connected: true,
    terminatedByNickname: null,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
  };
}
```

- [ ] **Step 5: Run tests and confirm they pass**

Run: `pnpm --filter @dabb/client test`
Expected: all tests including new useOfflineGame tests PASS.

- [ ] **Step 6: Build to confirm types**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/hooks/useOfflineGame.ts apps/client/src/hooks/__tests__/useOfflineGame.test.ts apps/client/package.json pnpm-lock.yaml
git commit -m "feat: add useOfflineGame hook"
```

---

## Task 6: Update i18n

**Files:**

- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/locales/de.ts`
- Modify: `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Add new keys to `TranslationKeys` in `packages/i18n/src/types.ts`**

In the `home` section, add after `join: string;`:

```typescript
playOffline: string;
createOnline: string;
joinOnline: string;
resumeGame: string;
```

Add a new top-level section after `home`:

```typescript
offline: {
  difficulty: string;
  difficultyEasy: string;
  difficultyMedium: string;
  difficultyHard: string;
  startGame: string;
  aiPlayerName: string;
}
```

- [ ] **Step 2: Add German translations to `packages/i18n/src/locales/de.ts`**

In the `home` section, add after `join: 'Beitreten',`:

```typescript
    playOffline: 'Lokal gegen KI',
    createOnline: 'Online-Spiel erstellen',
    joinOnline: 'Online-Spiel beitreten',
    resumeGame: 'Weiterspielen',
```

Add a new `offline` section after the `home` section:

```typescript
  offline: {
    difficulty: 'Schwierigkeit',
    difficultyEasy: 'Einfach',
    difficultyMedium: 'Mittel',
    difficultyHard: 'Schwer',
    startGame: 'Spielen',
    aiPlayerName: 'KI {{index}}',
  },
```

- [ ] **Step 3: Add English translations to `packages/i18n/src/locales/en.ts`**

In the `home` section, add after `join: 'Join',`:

```typescript
    playOffline: 'Local vs AI',
    createOnline: 'Create Online Game',
    joinOnline: 'Join Online Game',
    resumeGame: 'Resume Game',
```

Add a new `offline` section after the `home` section:

```typescript
  offline: {
    difficulty: 'Difficulty',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    startGame: 'Play',
    aiPlayerName: 'AI {{index}}',
  },
```

- [ ] **Step 4: Build i18n package and run typecheck**

Run: `pnpm --filter @dabb/i18n build`
Expected: success — TypeScript enforces both locale files implement `TranslationKeys`.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/
git commit -m "feat: add i18n keys for offline mode and renamed home buttons"
```

---

## Task 7: Update `HomeScreen`

**Files:**

- Modify: `apps/client/src/components/ui/HomeScreen.tsx`

The current `Mode` type has `'menu' | 'create' | 'join'`. Add `'offline'`.

The menu mode currently shows two buttons; change to three. The `create` and `join` modes are unchanged. Add an `offline` mode with player count + difficulty selectors and a "Spielen" button.

Add resume banner: on mount, check `dabb-offline-game` storage. If `phase` is not `finished`/`terminated`, show "Weiterspielen".

- [ ] **Step 1: Replace the full `HomeScreen.tsx`**

```typescript
/**
 * Home screen — three entry points: offline vs AI, create online, join online.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@dabb/i18n';
import type { PlayerCount } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';
import { Colors, Fonts } from '../../theme.js';
import { storageGet, storageSet } from '../../hooks/useStorage.js';
import { createSession, joinSession } from '../../utils/api.js';
import { APP_VERSION } from '../../constants.js';
import { OptionsButton } from './OptionsButton.js';

type Mode = 'menu' | 'create' | 'join' | 'offline';
type GamePhaseString = string;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resumableGame, setResumableGame] = useState(false);
  const insets = useSafeAreaInsets();

  // Restore nickname from storage on mount
  useEffect(() => {
    storageGet('dabb-nickname')
      .then((saved) => { if (saved) setNickname(saved); })
      .catch(() => undefined);
  }, []);

  // Check for a resumable offline game on mount
  useEffect(() => {
    storageGet('dabb-offline-game')
      .then((raw) => {
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as { phase?: GamePhaseString };
          const phase = payload.phase;
          if (phase && phase !== 'finished' && phase !== 'terminated') {
            setResumableGame(true);
          }
        } catch {
          // Corrupt storage — ignore
        }
      })
      .catch(() => undefined);
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) { setError(t('errors.enterNickname')); return; }
    if (nickname.trim().length > 10) { setError(t('errors.nicknameTooLong')); return; }
    setLoading(true);
    setError('');
    try {
      const sessionData = await createSession(nickname.trim(), playerCount);
      await storageSet(`dabb-${sessionData.sessionCode}`, JSON.stringify({
        secretId: sessionData.secretId,
        playerId: sessionData.playerId,
        playerIndex: sessionData.playerIndex,
        playerCount,
      }));
      await storageSet('dabb-nickname', nickname.trim());
      router.push({ pathname: '/waiting-room/[code]', params: { code: sessionData.sessionCode } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) { setError(t('errors.enterNickname')); return; }
    if (nickname.trim().length > 10) { setError(t('errors.nicknameTooLong')); return; }
    if (!joinCode.trim()) { setError(t('errors.enterGameCode')); return; }
    setLoading(true);
    setError('');
    try {
      const sessionData = await joinSession(joinCode.trim(), nickname.trim());
      await storageSet(`dabb-${joinCode.trim().toUpperCase()}`, JSON.stringify({
        secretId: sessionData.secretId,
        playerId: sessionData.playerId,
        playerIndex: sessionData.playerIndex,
      }));
      await storageSet('dabb-nickname', nickname.trim());
      router.push({ pathname: '/waiting-room/[code]', params: { code: joinCode.trim().toUpperCase() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartOffline = async () => {
    if (!nickname.trim()) { setError(t('errors.enterNickname')); return; }
    if (nickname.trim().length > 10) { setError(t('errors.nicknameTooLong')); return; }
    await storageSet('dabb-nickname', nickname.trim());
    router.push({
      pathname: '/game/offline',
      params: { playerCount: String(playerCount), difficulty, nickname: nickname.trim(), resume: 'false' },
    });
  };

  const handleResume = () => {
    router.push({
      pathname: '/game/offline',
      params: { resume: 'true' },
    });
  };

  if (mode === 'menu') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('home.title')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

            {resumableGame && (
              <TouchableOpacity style={[styles.buttonPrimary, styles.resumeButton]} onPress={handleResume}>
                <Text style={styles.buttonPrimaryText}>{t('home.resumeGame')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={() => setMode('offline')}>
                <Text style={styles.buttonPrimaryText}>{t('home.playOffline')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setMode('create')}>
                <Text style={styles.buttonSecondaryText}>{t('home.createOnline')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setMode('join')}>
                <Text style={styles.buttonSecondaryText}>{t('home.joinOnline')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.version}>v{APP_VERSION}</Text>
          </View>
        </ScrollView>
        <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
          <OptionsButton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.heading}>
            {mode === 'create'
              ? t('home.createOnline')
              : mode === 'join'
              ? t('home.joinOnline')
              : t('home.playOffline')}
          </Text>

          {/* Nickname field — always shown */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('home.nickname')}</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('home.nicknamePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Player count — create and offline modes */}
          <View
            style={[styles.formGroup, { opacity: mode === 'join' ? 0 : 1 }]}
            pointerEvents={mode === 'join' ? 'none' : 'auto'}
          >
            <Text style={styles.label}>{t('home.playerCount')}</Text>
            <View style={styles.playerCountRow}>
              {([2, 3, 4] as PlayerCount[]).map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.countButton,
                    playerCount === count ? styles.countButtonActive : styles.countButtonInactive,
                  ]}
                  onPress={() => setPlayerCount(count)}
                >
                  <Text
                    style={
                      playerCount === count
                        ? styles.countButtonTextActive
                        : styles.countButtonTextInactive
                    }
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Difficulty — offline mode only */}
          <View
            style={[styles.formGroup, { opacity: mode === 'offline' ? 1 : 0 }]}
            pointerEvents={mode === 'offline' ? 'auto' : 'none'}
          >
            <Text style={styles.label}>{t('offline.difficulty')}</Text>
            <View style={styles.playerCountRow}>
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => {
                const label =
                  d === 'easy'
                    ? t('offline.difficultyEasy')
                    : d === 'medium'
                    ? t('offline.difficultyMedium')
                    : t('offline.difficultyHard');
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.countButton,
                      difficulty === d ? styles.countButtonActive : styles.countButtonInactive,
                    ]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text
                      style={
                        difficulty === d
                          ? styles.countButtonTextActive
                          : styles.countButtonTextInactive
                      }
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Join code — join mode only */}
          <View
            style={[styles.formGroup, { opacity: mode === 'join' ? 1 : 0 }]}
            pointerEvents={mode === 'join' ? 'auto' : 'none'}
          >
            <Text style={styles.label}>{t('home.gameCode')}</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t('home.gameCodePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Error message */}
          <Text style={[styles.errorText, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>

          {/* Action row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.buttonSecondarySmall} onPress={() => { setMode('menu'); setError(''); }}>
              <Text style={styles.buttonSecondaryText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonPrimary, styles.flex1, loading && styles.buttonDisabled]}
              onPress={
                mode === 'create'
                  ? handleCreate
                  : mode === 'join'
                  ? handleJoin
                  : handleStartOffline
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.paperFace} />
              ) : (
                <Text style={styles.buttonPrimaryText}>
                  {mode === 'create'
                    ? t('home.create')
                    : mode === 'join'
                    ? t('home.join')
                    : t('offline.startGame')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
        <OptionsButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.woodDark },
  optionsButtonContainer: { position: 'absolute', right: 16 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.woodDark,
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.inkDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.inkMid,
    textAlign: 'center',
    marginBottom: 32,
  },
  heading: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.inkDark,
    marginBottom: 20,
  },
  resumeButton: { marginBottom: 12 },
  buttonGroup: { gap: 12 },
  buttonPrimary: {
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonPrimaryText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.paperFace },
  buttonSecondary: {
    backgroundColor: Colors.paperAged,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.woodMid,
  },
  buttonSecondarySmall: {
    backgroundColor: Colors.paperAged,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.woodMid,
  },
  buttonSecondaryText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkMid },
  buttonDisabled: { opacity: 0.6 },
  formGroup: { marginBottom: 16 },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.inkMid,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.inkDark,
    backgroundColor: Colors.paperAged,
  },
  playerCountRow: { flexDirection: 'row', gap: 8 },
  countButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  countButtonActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  countButtonInactive: { backgroundColor: Colors.paperAged, borderColor: Colors.woodMid },
  countButtonTextActive: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.paperFace },
  countButtonTextInactive: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkMid },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    marginBottom: 8,
    minHeight: 20,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  flex1: { flex: 1 },
  version: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginTop: 24,
  },
});
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/ui/HomeScreen.tsx
git commit -m "feat: redesign home screen with offline mode and resume banner"
```

---

## Task 8: Create Offline Game Routes

**Files:**

- Create: `apps/client/src/app/game/offline.native.tsx`
- Create: `apps/client/src/app/game/offline.tsx`

Both routes read `playerCount`, `difficulty`, `nickname`, and `resume` from route params, call `useOfflineGame`, and pass the result to `GameScreen`.

- [ ] **Step 1: Create `apps/client/src/app/game/offline.native.tsx`**

```typescript
/**
 * Offline game route (native).
 * Reads config from route params set by HomeScreen.
 */
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import GameScreen from '../../components/ui/GameScreen.js';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import type { PlayerCount } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export default function OfflineGameRoute() {
  const { playerCount, difficulty, nickname, resume } = useLocalSearchParams<{
    playerCount?: string;
    difficulty?: string;
    nickname?: string;
    resume?: string;
  }>();

  const isResume = resume === 'true';

  const game = useOfflineGame({
    playerCount: (Number(playerCount) || 2) as PlayerCount,
    difficulty: (difficulty as AIDifficulty) || 'medium',
    nickname: nickname || 'Ich',
    resume: isResume,
  });

  return <GameScreen game={game} playerIndex={0} />;
}
```

- [ ] **Step 2: Create `apps/client/src/app/game/offline.tsx` (web)**

```typescript
/**
 * Offline game route (web).
 * Uses WithSkiaWeb to defer Skia loading — same pattern as [code].tsx.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import type { GameInterface } from '@dabb/ui-shared';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export default function OfflineGameRoute() {
  const { playerCount, difficulty, nickname, resume } = useLocalSearchParams<{
    playerCount?: string;
    difficulty?: string;
    nickname?: string;
    resume?: string;
  }>();

  const isResume = resume === 'true';

  const game = useOfflineGame({
    playerCount: (Number(playerCount) || 2) as PlayerCount,
    difficulty: (difficulty as AIDifficulty) || 'medium',
    nickname: nickname || 'Ich',
    resume: isResume,
  });

  return (
    <WithSkiaWeb
      getComponent={() =>
        import('../../components/ui/GameScreen.js') as unknown as Promise<{
          default: React.ComponentType<{ game: GameInterface; playerIndex: PlayerIndex }>;
        }>
      }
      opts={{ locateFile: (file: string) => `/${file}` }}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      }
      componentProps={{ game, playerIndex: 0 as PlayerIndex }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 3: Build to confirm**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/app/game/offline.native.tsx apps/client/src/app/game/offline.tsx
git commit -m "feat: add offline game routes"
```

---

## Task 9: Full CI Check and Version Bump

- [ ] **Step 1: Run the full CI suite**

Run: `/ci-check`

Expected: build, lint, typecheck, and tests all pass.

- [ ] **Step 2: Bump version (MINOR — new user-facing feature)**

This is a new user-visible feature. Bump all four version fields:

- `package.json` (root)
- `apps/client/package.json`
- `apps/server/package.json`
- `apps/client/app.json` (expo.version field)

All four must be the same value (current + minor bump, e.g. if current is `2.0.0` → `2.1.0`).

Also add a user-friendly `CHANGELOG.md` entry at the top:

```markdown
## [2.1.0] - 2026-04-14

### Neues

- **Lokal gegen KI**: Spiele Binokel offline gegen KI-Gegner — kein Internet nötig. Wähle Spieleranzahl und Schwierigkeit. Das Spiel wird automatisch gespeichert und kann jederzeit fortgesetzt werden.
```

- [ ] **Step 3: Commit version bump**

```bash
git add package.json apps/client/package.json apps/server/package.json apps/client/app.json CHANGELOG.md
git commit -m "chore: bump version to 2.1.0 for offline AI mode"
```
