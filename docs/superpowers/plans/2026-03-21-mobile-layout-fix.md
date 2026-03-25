# Mobile Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile layout bugs: hand overflow in portrait, hand cut off in landscape, and phase dialog overflow.

**Architecture:** Four surgical changes — portrait lock in app config, dynamic card scaling in the pure layout function, overflow guard in PhaseOverlay, and a web scroll prevention flag on the game screen root.

**Tech Stack:** React Native, Expo, TypeScript, Vitest (tests), pnpm workspaces

---

### Task 1: Lock portrait orientation on native

**Files:**

- Modify: `apps/client/app.json`

- [ ] **Step 1: Change orientation field**

In `apps/client/app.json`, change:

```json
"orientation": "default",
```

to:

```json
"orientation": "portrait",
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/app.json
git commit -m "feat(client): lock portrait orientation on native"
```

---

### Task 2: Dynamic card scaling in `deriveCardPositions`

**Files:**

- Modify: `packages/game-canvas/src/cards/cardPositions.ts`
- Create: `packages/game-canvas/src/cards/__tests__/cardPositions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/game-canvas/src/cards/__tests__/cardPositions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveCardPositions } from '../cardPositions.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
const CARD_OVERLAP = 22;
const HAND_SIDE_MARGIN = 16;

function makeInput(cardCount: number) {
  return {
    handCardIds: Array.from({ length: cardCount }, (_, i) => `card-${i}`),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}

describe('deriveCardPositions — hand scaling', () => {
  it('does not scale down when hand fits comfortably (few cards, wide screen)', () => {
    const layout = { width: 800, height: 1200, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(5), layout);
    expect(result.cardScale).toBe(1);
  });

  it('scales down when 12 cards overflow a 375px portrait phone', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    expect(result.cardScale).toBeLessThan(1);
    // Verify hand fits within screen minus margins
    const n = 12;
    const scaledW = CARD_WIDTH * result.cardScale;
    const scaledOverlap = CARD_OVERLAP * result.cardScale;
    const handWidth = n * scaledW - (n - 1) * scaledOverlap;
    expect(handWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5); // +0.5 for float rounding
  });

  it('bottom-anchors the hand so it never goes off-screen', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    const firstCard = result.playerHand['card-0'];
    expect(firstCard).toBeDefined();
    const scaledH = CARD_HEIGHT * result.cardScale;
    // Bottom edge of cards = y + scaledH, should be <= height
    expect(firstCard!.y + scaledH).toBeLessThanOrEqual(812);
  });

  it('cards are horizontally centered', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(4), layout);
    const first = result.playerHand['card-0']!;
    const last = result.playerHand['card-3']!;
    const scaledW = CARD_WIDTH * result.cardScale;
    const midFirst = first.x + scaledW / 2;
    const midLast = last.x + scaledW / 2;
    const center = (midFirst + midLast) / 2;
    expect(center).toBeCloseTo(375 / 2, 0);
  });

  it('returns cardScale: 1 when hand is exactly the available width', () => {
    // Natural width of 3 cards at full size
    const n = 3;
    const naturalWidth = n * CARD_WIDTH - (n - 1) * CARD_OVERLAP;
    const screenWidth = naturalWidth + 2 * HAND_SIDE_MARGIN;
    const layout = { width: screenWidth, height: 800, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(n), layout);
    expect(result.cardScale).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @dabb/game-canvas test packages/game-canvas/src/cards/__tests__/cardPositions.test.ts
```

Expected: FAIL — `result.cardScale` is undefined (property does not exist yet).

- [ ] **Step 3: Implement dynamic scaling in `cardPositions.ts`**

Replace the content of `packages/game-canvas/src/cards/cardPositions.ts` with:

```typescript
/**
 * Pure position derivation for all cards on the table.
 * Takes a snapshot of card IDs + screen dimensions, returns pixel positions.
 * No React, no side effects. Reanimated consumes the output via CardView props.
 */

export interface LayoutDimensions {
  width: number;
  height: number;
  playerCount: 3 | 4;
}

export interface CardPosition {
  x: number;
  y: number;
  rotation: number; // degrees
  zIndex: number;
}

export interface TrickCardEntry {
  cardId: string;
  seatIndex: number; // which player seat played this card
}

export interface CardPositionsInput {
  handCardIds: string[];
  trickCardIds: TrickCardEntry[];
  wonPilePlayerIds: string[]; // ordered list of player IDs (determines corner assignment)
  opponentCardCounts: Record<string, number>; // playerId → remaining card count
}

export interface CardPositionsOutput {
  playerHand: Record<string, CardPosition>;
  trickCards: Record<string, CardPosition>;
  wonPiles: Record<string, { x: number; y: number }>;
  opponentHands: Record<string, { x: number; y: number; cardCount: number }>;
  /** Scale factor applied to card dimensions (1.0 = full size, <1.0 = scaled down to fit). */
  cardScale: number;
}

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
const CARD_OVERLAP = 22;
const HAND_SIDE_MARGIN = 16;
const HAND_BOTTOM_MARGIN = 10;
const TRICK_CENTER_X_FRACTION = 0.5;
const TRICK_CENTER_Y_FRACTION = 0.45;
const TRICK_CARD_SPREAD = 80;
const TRICK_ROTATIONS = [-4, 3, -2, 5];

/** Corner positions as [xFraction, yFraction] — index matches wonPilePlayerIds order */
const WON_PILE_CORNERS: [number, number][] = [
  [0.06, 0.9], // bottom-left  (player 0 = local player)
  [0.94, 0.06], // top-right    (opponent 1)
  [0.06, 0.06], // top-left     (opponent 2)
  [0.94, 0.9], // bottom-right (opponent 3)
];

export function deriveCardPositions(
  input: CardPositionsInput,
  layout: LayoutDimensions
): CardPositionsOutput {
  const { width, height } = layout;

  // Player hand — scale down if natural width overflows available screen width
  const n = input.handCardIds.length;
  const naturalWidth = n * CARD_WIDTH - Math.max(0, n - 1) * CARD_OVERLAP;
  const availableWidth = width - 2 * HAND_SIDE_MARGIN;
  const cardScale = n === 0 ? 1 : Math.min(1, availableWidth / naturalWidth);

  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const scaledOverlap = CARD_OVERLAP * cardScale;

  const handTotalWidth = n * scaledW - Math.max(0, n - 1) * scaledOverlap;
  const handStartX = (width - handTotalWidth) / 2;
  const handY = height - scaledH - HAND_BOTTOM_MARGIN;

  const playerHand: Record<string, CardPosition> = {};
  input.handCardIds.forEach((id, i) => {
    playerHand[id] = {
      x: handStartX + i * (scaledW - scaledOverlap),
      y: handY,
      rotation: (i - (n - 1) / 2) * 1.8,
      zIndex: i,
    };
  });

  // Trick cards
  const tc = input.trickCardIds.length;
  const trickStartX = width * TRICK_CENTER_X_FRACTION - ((tc - 1) * TRICK_CARD_SPREAD) / 2;
  const trickCards: Record<string, CardPosition> = {};
  input.trickCardIds.forEach(({ cardId }, i) => {
    trickCards[cardId] = {
      x: trickStartX + i * TRICK_CARD_SPREAD,
      y: height * TRICK_CENTER_Y_FRACTION,
      rotation: TRICK_ROTATIONS[i % TRICK_ROTATIONS.length] ?? 0,
      zIndex: i,
    };
  });

  // Won piles (one corner per player, ordered by wonPilePlayerIds)
  const wonPiles: Record<string, { x: number; y: number }> = {};
  input.wonPilePlayerIds.forEach((playerId, i) => {
    const [fx, fy] = WON_PILE_CORNERS[i % WON_PILE_CORNERS.length]!;
    wonPiles[playerId] = { x: width * fx, y: height * fy };
  });

  // Opponent hands (evenly spaced along top edge)
  const opponentIds = Object.keys(input.opponentCardCounts);
  const opponentHands: Record<string, { x: number; y: number; cardCount: number }> = {};
  opponentIds.forEach((id, i) => {
    const fraction = (i + 1) / (opponentIds.length + 1);
    opponentHands[id] = {
      x: width * fraction,
      y: height * 0.08,
      cardCount: input.opponentCardCounts[id] ?? 0,
    };
  });

  return { playerHand, trickCards, wonPiles, opponentHands, cardScale };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @dabb/game-canvas test packages/game-canvas/src/cards/__tests__/cardPositions.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts packages/game-canvas/src/cards/__tests__/cardPositions.test.ts
git commit -m "feat(game-canvas): dynamic card scaling and bottom-anchored hand position"
```

---

### Task 3: Pass scaled card dimensions from `PlayerHand` to `CardView`

**Files:**

- Modify: `apps/client/src/components/game/PlayerHand.tsx`

`PlayerHand` currently calls `deriveCardPositions` and passes positions to `CardView` without forwarding card size. Now that `deriveCardPositions` returns `cardScale`, `PlayerHand` needs to compute `scaledW`/`scaledH` and pass them to each `CardView`. It also needs to scale the discard-mode lift offset (currently hard-coded to `-20`).

- [ ] **Step 1: Update `PlayerHand.tsx`**

Replace the file content with:

```typescript
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  CardView,
  deriveCardPositions,
  getFeltBounds,
  type LayoutDimensions,
  type SkiaEffects,
} from '@dabb/game-canvas';
import { getValidPlays, sortHand } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Card } from '@dabb/shared-types';
import { playSound } from '../../utils/sounds.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { computeHighlightedDabbIds } from './dabbHighlighting.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string, dropPos?: { x: number; y: number }) => void;
  effects?: SkiaEffects;
  discardSelectedIds?: string[];
  onToggleDiscard?: (cardId: string) => void;
}

export function PlayerHand({
  gameState,
  playerIndex: _playerIndex,
  cards,
  onPlayCard,
  effects,
  discardSelectedIds,
  onToggleDiscard,
}: PlayerHandProps) {
  const { width, height } = useWindowDimensions();
  const feltBounds = getFeltBounds(width, height);

  if (!gameState) {
    return null;
  }

  const layout: LayoutDimensions = {
    width,
    height,
    playerCount: gameState.players.length as 3 | 4,
  };

  const sortedCards = sortHand(cards);

  const positions = deriveCardPositions(
    {
      handCardIds: sortedCards.map((c) => c.id),
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const { cardScale } = positions;
  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const liftOffset = 20 * cardScale;

  const isTricksPhase = gameState.phase === 'tricks';
  const isTrumpHighlightPhase =
    (gameState.phase === 'tricks' || gameState.phase === 'melding') && gameState.trump !== null;
  const isDiscardMode = !!onToggleDiscard;
  const validPlays =
    isTricksPhase && gameState.trump
      ? getValidPlays(cards, gameState.currentTrick, gameState.trump)
      : [];
  const validIds = new Set(validPlays.map((c) => c.id));
  const highlightedIds = computeHighlightedDabbIds(gameState.phase, gameState.dabbCardIds);

  const handleDrop = (cardId: string) => (x: number, y: number) => {
    const onFelt =
      x >= feltBounds.x &&
      x <= feltBounds.x + feltBounds.width &&
      y >= feltBounds.y &&
      y <= feltBounds.y + feltBounds.height;
    if (onFelt && validIds.has(cardId)) {
      onPlayCard(cardId, { x, y });
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sortedCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) {
          return null;
        }
        if (isDiscardMode) {
          const isSelected = discardSelectedIds?.includes(card.id) ?? false;
          return (
            <CardView
              key={card.id}
              card={card.id}
              targetX={pos.x}
              targetY={isSelected ? pos.y - liftOffset : pos.y}
              targetRotation={pos.rotation}
              zIndex={isSelected ? pos.zIndex + 100 : pos.zIndex}
              width={scaledW}
              height={scaledH}
              selected={isSelected}
              highlighted={highlightedIds.has(card.id)}
              isTrump={isTrumpHighlightPhase && card.suit === gameState.trump}
              onTap={() => {
                playSound('card-select');
                triggerHaptic('card-select');
                onToggleDiscard!(card.id);
              }}
            />
          );
        }
        const isValid = !isTricksPhase || validIds.has(card.id);
        return (
          <CardView
            key={card.id}
            card={card.id}
            targetX={pos.x}
            targetY={pos.y}
            targetRotation={pos.rotation}
            zIndex={pos.zIndex}
            width={scaledW}
            height={scaledH}
            draggable={isTricksPhase && isValid}
            dimmed={isTricksPhase && !isValid}
            highlighted={highlightedIds.has(card.id)}
            isTrump={isTrumpHighlightPhase && card.suit === gameState.trump}
            effects={isTricksPhase && isValid ? effects : undefined}
            onTap={
              isTricksPhase && isValid
                ? () => {
                    playSound('card-select');
                    triggerHaptic('card-select');
                    onPlayCard(card.id);
                  }
                : undefined
            }
            onDrop={isTricksPhase && isValid ? handleDrop(card.id) : undefined}
          />
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Run the full test suite to check nothing is broken**

```bash
pnpm test
```

Expected: all tests PASS (no test touches CardView rendering directly).

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/PlayerHand.tsx
git commit -m "feat(client): pass scaled card dimensions to CardView"
```

---

### Task 4: Overflow-safe `PhaseOverlay`

**Files:**

- Modify: `packages/game-canvas/src/overlays/PhaseOverlay.tsx`

The overlay needs a max-height cap (computed from actual screen dimensions, not a percentage) and a `ScrollView` wrapper so tall content (e.g. DabbOverlay discard step) scrolls within the dialog rather than overflowing.

- [ ] **Step 1: Update `PhaseOverlay.tsx`**

Replace the file content with:

```typescript
/**
 * PhaseOverlay — animated wrapper that slides/fades content in and out.
 *
 * visible=true  → fade in + slide up from -40px + scale from 0.92
 * visible=false → fade out + slide to -20px + scale to 0.95
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

export interface PhaseOverlayProps {
  visible: boolean;
  rotation?: number;
  children: React.ReactNode;
}

export function PhaseOverlay({ visible, rotation = -2, children }: PhaseOverlayProps) {
  const { height: screenHeight } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-20, { duration: 180 });
      scale.value = withTiming(0.95, { duration: 180 });
    }
  }, [visible]);

  const outerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  const maxPaperHeight = screenHeight * 0.7;

  return (
    <AnimatedView style={[styles.container, outerStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={[styles.paper, { maxHeight: maxPaperHeight }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    zIndex: 100,
  },
  paper: {
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 240,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
});
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/game-canvas/src/overlays/PhaseOverlay.tsx
git commit -m "feat(game-canvas): cap PhaseOverlay height and make content scrollable"
```

---

### Task 5: Prevent game screen scroll on web

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Add `overflow: 'hidden'` to the container style**

In `apps/client/src/components/ui/GameScreen.tsx`, find the styles block at the bottom:

```typescript
  container: {
    flex: 1,
    backgroundColor: '#1a0f05',
  },
```

Change it to:

```typescript
  container: {
    flex: 1,
    backgroundColor: '#1a0f05',
    overflow: 'hidden',
  },
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "fix(client): prevent page scroll on web game screen"
```

---

### Task 6: CI check

- [ ] **Step 1: Run CI verification**

```bash
pnpm run build && pnpm lint && pnpm test
```

Expected: build succeeds (TypeScript type check passes), lint clean, all tests pass.

If any step fails, fix the issue before proceeding.

- [ ] **Step 2: Done**

All five files changed, all tests passing. The three mobile layout bugs are fixed.
