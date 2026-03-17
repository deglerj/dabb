# Trick Card Animations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cards disappearing instantly after a trick is won, and add arc flight animation when a card is played and a sweep animation when the winning player takes the trick.

**Architecture:** Replace the static `TrickArea` component with a full-screen `TrickAnimationLayer` that renders trick cards in screen coordinates, driven by a new `useTrickAnimationState` hook that manages idle→showing→paused→sweeping phase transitions with timers. `CardView` gains optional `initialX/initialY` props to snap-then-arc from an origin to its target on mount.

**Tech Stack:** React Native, react-native-reanimated (`withTiming`, `withSequence`, `Easing`), `@dabb/game-canvas` (`deriveCardPositions`, `CardView`), `@dabb/ui-shared`, Vitest + `@testing-library/react` (jsdom) for hook tests.

---

## Chunk 1: Arc animation in CardView

**Files:**

- Modify: `packages/game-canvas/src/cards/CardView.tsx`

### Task 1: Add `initialX`/`initialY` and arc Y animation to `CardView`

`CardView` currently initializes its Reanimated shared values to `targetX/Y` and animates to new targets on every prop change. We add optional `initialX/initialY` to snap the card to an origin on mount, then animate to target — using a two-step `withSequence` for Y to produce an arc.

- [ ] **Step 1: Read the current file**

  Read `packages/game-canvas/src/cards/CardView.tsx` to confirm the current shape before editing.

- [ ] **Step 2: Update imports to add `withSequence` and `useRef`**

  Edit the React import line (currently `import React, { useEffect } from 'react';`):

  ```typescript
  import React, { useEffect, useRef } from 'react';
  ```

  Edit the reanimated import to add `withSequence`:

  ```typescript
  import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    Easing,
  } from 'react-native-reanimated';
  ```

- [ ] **Step 3: Add `initialX` and `initialY` to the props interface**

  In `CardViewProps`, add after `animationDuration?`:

  ```typescript
  /** If provided, card snaps to this position on mount before animating to targetX. */
  initialX?: number;
  /** If provided, card arcs from this Y position on mount. */
  initialY?: number;
  ```

- [ ] **Step 4: Add arc constant at module level; replace the `CardView` function**

  First add this constant at module level, directly after `const DEFAULT_H = 105;`:

  ```typescript
  const ARC_LIFT_PX = 60;
  ```

  Then replace the entire `CardView` function (from `export function CardView({` through the closing `}`) with:

  ```typescript
  export function CardView({
    card,
    targetX,
    targetY,
    targetRotation,
    zIndex,
    width = DEFAULT_W,
    height = DEFAULT_H,
    draggable = false,
    onTap,
    onDrop,
    animationDuration = 400,
    initialX,
    initialY,
  }: CardViewProps) {
    // Snap to initial position on mount (or target if no initial given)
    const x = useSharedValue(initialX ?? targetX);
    const y = useSharedValue(initialY ?? targetY);
    const rotation = useSharedValue(targetRotation);
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isFirstRender = useRef(true);

    useEffect(() => {
      const cfg = { duration: animationDuration, easing: Easing.out(Easing.cubic) };
      const firstRender = isFirstRender.current;
      isFirstRender.current = false;

      x.value = withTiming(targetX, cfg);
      rotation.value = withTiming(targetRotation, { duration: animationDuration });

      if (firstRender && initialY !== undefined) {
        // Arc: rise to peak then drop to target
        const peakY = (initialY + targetY) / 2 - ARC_LIFT_PX;
        const half = Math.round(animationDuration / 2);
        y.value = withSequence(
          withTiming(peakY, { duration: half, easing: Easing.out(Easing.cubic) }),
          withTiming(targetY, { duration: half, easing: Easing.in(Easing.cubic) }),
        );
      } else {
        y.value = withTiming(targetY, cfg);
      }
    }, [targetX, targetY, targetRotation, animationDuration, initialY]);

    const animatedStyle = useAnimatedStyle(() => ({
      position: 'absolute' as const,
      left: x.value + translateX.value,
      top: y.value + translateY.value,
      zIndex,
      transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    }));

    const gesture = createCardGesture({ draggable, onTap, onDrop, translateX, translateY, scale });

    return (
      <GestureDetector gesture={gesture}>
        <AnimatedView style={animatedStyle}>
          {card !== null ? (
            <CardFace card={card} width={width} height={height} />
          ) : (
            <CardBack width={width} height={height} />
          )}
        </AnimatedView>
      </GestureDetector>
    );
  }
  ```

- [ ] **Step 5: Typecheck**

  ```bash
  pnpm --filter @dabb/game-canvas run typecheck
  ```

  Expected: no errors. (`game-canvas` has no compiled build step — the full build check happens in Task 7.)

- [ ] **Step 6: Commit**

  ```bash
  git add packages/game-canvas/src/cards/CardView.tsx
  git commit -m "feat(game-canvas): add initialX/initialY arc animation to CardView"
  ```

---

## Chunk 2: `useTrickAnimationState` hook

**Files:**

- Create: `packages/ui-shared/src/useTrickAnimationState.ts`
- Create: `packages/ui-shared/src/__tests__/useTrickAnimationState.test.ts`
- Create: `packages/ui-shared/vitest.config.ts`
- Modify: `packages/ui-shared/package.json`
- Modify: `packages/ui-shared/src/index.ts`

### Task 2: Add test infrastructure to `@dabb/ui-shared`

The `ui-shared` package has no vitest setup. We need it to test the new hook.

- [ ] **Step 1: Add test dependencies**

  ```bash
  pnpm --filter @dabb/ui-shared add -D vitest @vitest/coverage-v8 @testing-library/react jsdom
  ```

  Expected: packages installed, `package.json` updated.

- [ ] **Step 2: Add `test` and `test:coverage` scripts to `packages/ui-shared/package.json`**

  In the `"scripts"` section, add:

  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
  ```

- [ ] **Step 3: Create `packages/ui-shared/vitest.config.ts`**

  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.ts'],
        exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
      },
    },
  });
  ```

- [ ] **Step 4: Verify test setup runs (no tests yet)**

  ```bash
  pnpm --filter @dabb/ui-shared test
  ```

  Expected: "No test files found" or 0 tests run — no errors.

### Task 3: Write `useTrickAnimationState` hook with tests (TDD)

The hook manages these phases for trick card display:

- `idle` — no cards shown
- `showing` — cards in `currentTrick` are displayed (card just played → animates from origin via `CardView`)
- `paused` — trick won; shows completed trick cards for 3 seconds
- `sweeping` — after pause; cards animate to winner's corner one by one (staggered 200ms apart)

`sweepingCardCount` grows from 0 to `numCards` during sweeping, signalling `TrickAnimationLayer` to send cards to the corner.

- [ ] **Step 1: Create `packages/ui-shared/src/__tests__/useTrickAnimationState.test.ts` with failing tests**

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { renderHook, act } from '@testing-library/react';
  import { useTrickAnimationState } from '../useTrickAnimationState.js';
  import type { CompletedTrick, Player, Trick } from '@dabb/shared-types';

  // --- Test fixtures ---

  const players: Player[] = [
    { id: 'p0', nickname: 'Alice', playerIndex: 0, connected: true },
    { id: 'p1', nickname: 'Bob', playerIndex: 1, connected: true },
    { id: 'p2', nickname: 'Carol', playerIndex: 2, connected: true },
  ];

  const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

  const pc = (cardId: string, playerIndex: 0 | 1 | 2 | 3) => ({
    cardId,
    card: { id: cardId, suit: 'kreuz' as const, rank: 'ass' as const, copy: 0 as const },
    playerIndex,
  });

  const trickWith1: Trick = {
    cards: [pc('card-a', 0)],
    leadSuit: 'kreuz',
    winnerIndex: null,
  };
  const trickWith3: Trick = {
    cards: [pc('card-a', 0), pc('card-b', 1), pc('card-c', 2)],
    leadSuit: 'kreuz',
    winnerIndex: null,
  };

  const completedTrick3: CompletedTrick = {
    cards: [pc('card-a', 0), pc('card-b', 1), pc('card-c', 2)],
    winnerIndex: 1,
    points: 20,
  };

  // --- Tests ---

  describe('useTrickAnimationState', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('starts in idle with no cards', () => {
      const { result } = renderHook(() =>
        useTrickAnimationState(emptyTrick, null, 'tricks', players)
      );
      expect(result.current.animPhase).toBe('idle');
      expect(result.current.displayCards).toHaveLength(0);
    });

    it('transitions to showing when currentTrick has cards', () => {
      const { result, rerender } = renderHook(
        ({ trick }) => useTrickAnimationState(trick, null, 'tricks', players),
        { initialProps: { trick: emptyTrick } }
      );

      act(() => {
        rerender({ trick: trickWith1 });
      });

      expect(result.current.animPhase).toBe('showing');
      expect(result.current.displayCards).toHaveLength(1);
    });

    it('transitions to paused when a trick is completed, shows completed cards', () => {
      const { result, rerender } = renderHook(
        ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
        { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
      );

      act(() => {
        rerender({ trick: emptyTrick, completed: completedTrick3 });
      });

      expect(result.current.animPhase).toBe('paused');
      expect(result.current.displayCards).toHaveLength(3);
      expect(result.current.winnerIndex).toBe(1);
      expect(result.current.winnerPlayerId).toBe('p1');
    });

    it('transitions to sweeping after 3s pause, then idle after sweep completes', () => {
      const { result, rerender } = renderHook(
        ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
        { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
      );

      act(() => {
        rerender({ trick: emptyTrick, completed: completedTrick3 });
      });
      expect(result.current.animPhase).toBe('paused');

      // Advance past 3s pause
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.animPhase).toBe('sweeping');
      expect(result.current.sweepingCardCount).toBe(0);

      // After sweep completes (3 cards: 2*200 + 400 = 800ms)
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(result.current.animPhase).toBe('idle');
      expect(result.current.displayCards).toHaveLength(0);
    });

    it('staggers sweepingCardCount during sweeping phase', () => {
      const { result, rerender } = renderHook(
        ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
        { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
      );

      act(() => {
        rerender({ trick: emptyTrick, completed: completedTrick3 });
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.sweepingCardCount).toBe(0);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.sweepingCardCount).toBe(1);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.sweepingCardCount).toBe(2);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.sweepingCardCount).toBe(3);
    });

    it('cancels pause early when a new card is played during pause', () => {
      const { result, rerender } = renderHook(
        ({ trick, completed }) => useTrickAnimationState(trick, completed, 'tricks', players),
        { initialProps: { trick: trickWith3, completed: null as CompletedTrick | null } }
      );

      act(() => {
        rerender({ trick: emptyTrick, completed: completedTrick3 });
      });
      expect(result.current.animPhase).toBe('paused');

      // New card played before 3s
      act(() => {
        rerender({ trick: trickWith1, completed: completedTrick3 });
      });

      expect(result.current.animPhase).toBe('showing');
      expect(result.current.displayCards).toHaveLength(1);

      // Advance past original 3s — no transition to sweeping
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      expect(result.current.animPhase).toBe('showing');
    });

    it('does not trigger pause on initial load with stale lastCompletedTrick', () => {
      // Simulate reconnection: lastCompletedTrick is already set at mount
      const { result } = renderHook(() =>
        useTrickAnimationState(emptyTrick, completedTrick3, 'tricks', players)
      );
      expect(result.current.animPhase).toBe('idle');
    });

    it('returns idle when phase is not tricks', () => {
      const { result, rerender } = renderHook(
        ({ phase }) => useTrickAnimationState(trickWith3, null, phase, players),
        { initialProps: { phase: 'tricks' as const } }
      );

      expect(result.current.animPhase).toBe('showing');

      act(() => {
        rerender({ phase: 'scoring' });
      });

      expect(result.current.animPhase).toBe('idle');
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they all fail**

  ```bash
  pnpm --filter @dabb/ui-shared test
  ```

  Expected: all 7 tests FAIL with "Cannot find module '../useTrickAnimationState.js'".

- [ ] **Step 3: Create `packages/ui-shared/src/useTrickAnimationState.ts`**

  ```typescript
  import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
  import type {
    CompletedTrick,
    GamePhase,
    Player,
    PlayerIndex,
    PlayedCard,
    Trick,
  } from '@dabb/shared-types';

  const PAUSE_DURATION = 3000;
  const SWEEP_ARRIVAL_GAP = 200;
  const SWEEP_CARD_DURATION = 400;

  export type TrickAnimPhase = 'idle' | 'showing' | 'paused' | 'sweeping';

  export interface TrickAnimationResult {
    animPhase: TrickAnimPhase;
    /** Cards to render (current trick during showing, completed trick during pause/sweep) */
    displayCards: PlayedCard[];
    winnerIndex: PlayerIndex | null;
    /** Player ID of winner — key into wonPiles from deriveCardPositions */
    winnerPlayerId: string | null;
    /**
     * During 'sweeping': number of cards whose sweep target should be revealed.
     * Increments from 0 to displayCards.length over time (one per SWEEP_ARRIVAL_GAP ms).
     * Cards at index < sweepingCardCount should animate to the winner's corner.
     */
    sweepingCardCount: number;
  }

  export function useTrickAnimationState(
    currentTrick: Trick,
    lastCompletedTrick: CompletedTrick | null,
    phase: GamePhase,
    players: Player[]
  ): TrickAnimationResult {
    const [animPhase, setAnimPhase] = useState<TrickAnimPhase>('idle');
    const [displayCards, setDisplayCards] = useState<PlayedCard[]>([]);
    const [winnerIndex, setWinnerIndex] = useState<PlayerIndex | null>(null);
    const [winnerPlayerId, setWinnerPlayerId] = useState<string | null>(null);
    const [sweepingCardCount, setSweepingCardCount] = useState(0);

    const prevTrickKeyRef = useRef<string | null>(null);
    const initialLoadRef = useRef(true);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearAllTimers = useCallback(() => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }, []);

    // Track current trick cards during 'showing' phase
    useEffect(() => {
      if (animPhase === 'paused' || animPhase === 'sweeping') return;
      if (phase !== 'tricks') {
        if (animPhase !== 'idle') {
          setAnimPhase('idle');
          setDisplayCards([]);
        }
        return;
      }
      if (currentTrick.cards.length > 0) {
        setAnimPhase('showing');
        setDisplayCards(currentTrick.cards);
      }
    }, [currentTrick.cards, phase, animPhase]);

    // Detect new completed trick → start pause → then sweep
    useLayoutEffect(() => {
      if (!lastCompletedTrick) {
        if (initialLoadRef.current) initialLoadRef.current = false;
        return;
      }

      const trickKey = lastCompletedTrick.cards.map((c) => c.cardId).join(',');

      // Skip stale trick on initial load (reconnection guard)
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        prevTrickKeyRef.current = trickKey;
        return;
      }

      if (trickKey === prevTrickKeyRef.current) return;
      prevTrickKeyRef.current = trickKey;

      clearAllTimers();

      const winner = players.find((p) => p.playerIndex === lastCompletedTrick.winnerIndex);
      setAnimPhase('paused');
      setDisplayCards(lastCompletedTrick.cards);
      setWinnerIndex(lastCompletedTrick.winnerIndex);
      setWinnerPlayerId(winner?.id ?? null);
      setSweepingCardCount(0);

      const pauseTimer = setTimeout(() => {
        setAnimPhase('sweeping');
        const numCards = lastCompletedTrick.cards.length;

        // Stagger sweep: one card starts moving every SWEEP_ARRIVAL_GAP ms
        for (let i = 0; i < numCards; i++) {
          const t = setTimeout(() => {
            setSweepingCardCount((prev) => prev + 1);
          }, i * SWEEP_ARRIVAL_GAP);
          timersRef.current.push(t);
        }

        // After all cards arrive + animation finishes, return to idle
        const totalSweepMs = (numCards - 1) * SWEEP_ARRIVAL_GAP + SWEEP_CARD_DURATION;
        const doneTimer = setTimeout(() => {
          setAnimPhase('idle');
          setDisplayCards([]);
          setWinnerIndex(null);
          setWinnerPlayerId(null);
          setSweepingCardCount(0);
        }, totalSweepMs);
        timersRef.current.push(doneTimer);
      }, PAUSE_DURATION);

      timersRef.current.push(pauseTimer);
    }, [lastCompletedTrick, players, clearAllTimers]);

    // Cancel pause early if next card is played while paused
    useEffect(() => {
      if (animPhase === 'paused' && currentTrick.cards.length > 0) {
        clearAllTimers();
        setAnimPhase('showing');
        setDisplayCards(currentTrick.cards);
        setWinnerIndex(null);
        setWinnerPlayerId(null);
      }
    }, [animPhase, currentTrick.cards.length, clearAllTimers]);

    // Cleanup on unmount
    useEffect(() => {
      return () => clearAllTimers();
    }, [clearAllTimers]);

    return { animPhase, displayCards, winnerIndex, winnerPlayerId, sweepingCardCount };
  }
  ```

- [ ] **Step 4: Run tests — expect all to pass**

  ```bash
  pnpm --filter @dabb/ui-shared test
  ```

  Expected: 7 tests PASS. If any fail, read the error, fix the hook, and re-run before continuing.

### Task 4: Update `ui-shared` package index

- [ ] **Step 1: Edit `packages/ui-shared/src/index.ts`**

  Remove the two `useTrickDisplay` lines and add the new hook:

  Remove:

  ```typescript
  export { useTrickDisplay } from './useTrickDisplay.js';
  export type { TrickDisplayResult } from './useTrickDisplay.js';
  ```

  Add after the `useCelebration` exports:

  ```typescript
  export { useTrickAnimationState } from './useTrickAnimationState.js';
  export type { TrickAnimationResult, TrickAnimPhase } from './useTrickAnimationState.js';
  ```

- [ ] **Step 2: Delete `packages/ui-shared/src/useTrickDisplay.ts`**

  ```bash
  rm packages/ui-shared/src/useTrickDisplay.ts
  ```

- [ ] **Step 3: Build to confirm no broken imports**

  ```bash
  pnpm --filter @dabb/ui-shared run build
  ```

  Expected: compiles without errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui-shared/
  git commit -m "feat(ui-shared): add useTrickAnimationState hook, add vitest setup, remove useTrickDisplay"
  ```

---

## Chunk 3: `TrickAnimationLayer` and `GameScreen` wiring

**Files:**

- Create: `apps/client/src/components/game/TrickAnimationLayer.tsx`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`
- Delete: `apps/client/src/components/game/TrickArea.tsx`

### Task 5: Create `TrickAnimationLayer`

This full-screen absolute overlay replaces `TrickArea`. It renders cards using `deriveCardPositions` for all position calculations (trick-center, won-piles, opponent-hand origins).

**How positions work:**

- `trickCards[cardId]` → where each card sits on the table (settled position)
- `opponentHands[playerId]` → where opponent cards come _from_ (y = `height * 0.08`)
- `wonPiles[winnerPlayerId]` → where sweep goes (keyed by player ID string)
- Self origin → `(width / 2, height * 0.82)` (center of local player's hand)

**Key invariant:** `wonPilePlayerIds` must be ordered by `playerIndex` ascending (0, 1, 2, …). `WON_PILE_CORNERS` in `cardPositions.ts` assigns corners by this order: player 0 = bottom-left, player 1 = top-right, player 2 = top-left, player 3 = bottom-right.

- [ ] **Step 1: Create `apps/client/src/components/game/TrickAnimationLayer.tsx`**

  ```tsx
  /**
   * TrickAnimationLayer — full-screen absolute overlay for trick card animations.
   *
   * Replaces TrickArea. Renders trick cards in screen coordinates with:
   * - Arc flight animation on first render (via CardView initialX/Y)
   * - 3-second pause after trick won (handled by useTrickAnimationState)
   * - Staggered sweep to winner's corner (sweepingCardCount from hook)
   */
  import React from 'react';
  import { View, StyleSheet, useWindowDimensions } from 'react-native';
  import { CardView, deriveCardPositions } from '@dabb/game-canvas';
  import type { Player, PlayerIndex } from '@dabb/shared-types';
  import type { TrickAnimationResult } from '@dabb/ui-shared';

  const HAND_Y_FRACTION = 0.82;

  export interface TrickAnimationLayerProps {
    animState: TrickAnimationResult;
    myPlayerIndex: PlayerIndex;
    players: Player[];
    playerCount: 3 | 4;
  }

  export function TrickAnimationLayer({
    animState,
    myPlayerIndex,
    players,
    playerCount,
  }: TrickAnimationLayerProps) {
    const { width, height } = useWindowDimensions();
    const { animPhase, displayCards, winnerPlayerId, sweepingCardCount } = animState;

    if (animPhase === 'idle' || displayCards.length === 0) {
      return null;
    }

    // Order players by playerIndex so WON_PILE_CORNERS assigns correctly:
    // index 0 = bottom-left, 1 = top-right, 2 = top-left, 3 = bottom-right
    const sortedPlayers = [...players].sort((a, b) => a.playerIndex - b.playerIndex);
    const wonPilePlayerIds = sortedPlayers.map((p) => p.id);

    // Opponents need an entry in opponentCardCounts so deriveCardPositions computes
    // their hand positions. The count value doesn't affect x/y.
    // Sort by playerIndex so Object.keys() iteration order is deterministic and
    // matches the visual left-to-right order (lowest playerIndex → leftmost position).
    const opponentCardCounts: Record<string, number> = {};
    [...players]
      .filter((p) => p.playerIndex !== myPlayerIndex)
      .sort((a, b) => a.playerIndex - b.playerIndex)
      .forEach((p) => {
        opponentCardCounts[p.id] = 1;
      });

    const positions = deriveCardPositions(
      {
        handCardIds: [],
        trickCardIds: displayCards.map((pc, i) => ({ cardId: pc.cardId, seatIndex: i })),
        wonPilePlayerIds,
        opponentCardCounts,
      },
      { width, height, playerCount }
    );

    const sweepDest = winnerPlayerId ? positions.wonPiles[winnerPlayerId] : null;

    // Where does this player's card fly *from*?
    // Self → center of hand; opponent → their hand zone along the top
    const getOrigin = (playerIndex: PlayerIndex): { x: number; y: number } => {
      if (playerIndex === myPlayerIndex) {
        return { x: width / 2, y: height * HAND_Y_FRACTION };
      }
      const player = players.find((p) => p.playerIndex === playerIndex);
      if (player) {
        const oh = positions.opponentHands[player.id];
        if (oh) return { x: oh.x, y: oh.y };
      }
      return { x: width / 2, y: height * 0.08 };
    };

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {displayCards.map((pc, i) => {
          const settled = positions.trickCards[pc.cardId];
          if (!settled) return null;

          // Card moves to sweep destination once its index is unlocked by sweepingCardCount
          const isSweeping =
            animPhase === 'sweeping' && sweepDest !== null && i < sweepingCardCount;
          const targetX = isSweeping ? sweepDest.x : settled.x;
          const targetY = isSweeping ? sweepDest.y : settled.y;
          const targetRotation = isSweeping ? 0 : settled.rotation;
          const origin = getOrigin(pc.playerIndex);

          return (
            <CardView
              key={pc.cardId}
              card={pc.cardId}
              targetX={targetX}
              targetY={targetY}
              targetRotation={targetRotation}
              zIndex={isSweeping ? 10 + i : settled.zIndex}
              // initialX/Y used only on first mount — CardView arcs from here to target
              initialX={origin.x}
              initialY={origin.y}
            />
          );
        })}
      </View>
    );
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm --filter @dabb/client run typecheck 2>&1 | head -30
  ```

  Expected: no errors in `TrickAnimationLayer.tsx`. (Other errors from GameScreen still referencing TrickArea are fine at this point.)

### Task 6: Wire `GameScreen`, delete old files

- [ ] **Step 1: Read `apps/client/src/components/ui/GameScreen.tsx`** to understand current imports and TrickArea usage.

- [ ] **Step 2: Edit imports in `GameScreen.tsx`**

  Remove:

  ```typescript
  import { TrickArea } from '../game/TrickArea.js';
  ```

  Add:

  ```typescript
  import { TrickAnimationLayer } from '../game/TrickAnimationLayer.js';
  ```

  In the `@dabb/ui-shared` import, add `useTrickAnimationState`:

  ```typescript
  import { useGameLog, useTrickAnimationState } from '@dabb/ui-shared';
  ```

- [ ] **Step 3: Replace the `trickCards` memo with `useTrickAnimationState`**

  Remove this block (around line 158–166):

  ```typescript
  // Trick cards for TrickArea
  const trickCards = useMemo(
    () =>
      state.currentTrick.cards.map((pc) => ({
        cardId: pc.cardId,
        playerIndex: pc.playerIndex,
      })),
    [state.currentTrick.cards]
  );
  ```

  Add after the `myCards` memo (around line 156):

  ```typescript
  // Trick animation state machine
  const trickAnimState = useTrickAnimationState(
    state.currentTrick,
    state.lastCompletedTrick,
    state.phase,
    state.players
  );
  ```

- [ ] **Step 4: Replace `<TrickArea>` with `<TrickAnimationLayer>` in the JSX**

  Remove:

  ```tsx
  {
    /* Trick area */
  }
  <View style={styles.trickArea}>
    <TrickArea
      trickCards={trickCards}
      playerCount={state.playerCount}
      myPlayerIndex={playerIndex}
    />
  </View>;
  ```

  Add (inside the return, after the `{/* Opponents */}` block, before `{/* Player hand */}`):

  ```tsx
  {
    /* Trick animation layer */
  }
  <TrickAnimationLayer
    animState={trickAnimState}
    myPlayerIndex={playerIndex}
    players={state.players}
    playerCount={state.playerCount as 3 | 4}
  />;
  ```

- [ ] **Step 5: Remove the `trickArea` style if it's now unused**

  Check if `styles.trickArea` is referenced anywhere else in the file. If not, delete it from the `StyleSheet.create({...})` at the bottom.

- [ ] **Step 6: Delete old files**

  ```bash
  rm apps/client/src/components/game/TrickArea.tsx
  ```

- [ ] **Step 7: Typecheck the client**

  ```bash
  pnpm --filter @dabb/client run typecheck
  ```

  Expected: no errors. If any remain, read and fix them before continuing.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/client/src/components/game/TrickAnimationLayer.tsx
  git add apps/client/src/components/ui/GameScreen.tsx
  git add -u apps/client/src/components/game/TrickArea.tsx
  git commit -m "feat(client): replace TrickArea with TrickAnimationLayer, wire useTrickAnimationState"
  ```

### Task 7: Full CI check

- [ ] **Step 1: Run the full CI suite**

  ```bash
  pnpm run build && pnpm test && pnpm run typecheck && pnpm lint
  ```

  Expected: all pass. Fix any failures before continuing.

  Common issues to check:
  - `pnpm run build` catches TypeScript errors that `pnpm test` misses (client uses `tsc && vite build`)
  - Lint may flag unused imports — remove them

- [ ] **Step 2: Final commit if any fixes were needed**

  ```bash
  git add -A
  git commit -m "fix: resolve CI issues from trick animation implementation"
  ```
