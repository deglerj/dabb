# Discard UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tap-to-select discard step with a floating dialog showing 4 card slots the player fills by tapping hand cards.

**Architecture:** New `DiscardOverlay` in `game-canvas` renders a scrim + centered card-slot dialog with an inline Go Out flow. `PlayerHand` gains a slot mode: slotted cards are hidden, remaining cards call `onSlotCard` on tap. `DabbOverlay` is simplified to take-only. `GameScreen` orchestrates the new state and wires the three components together.

**Tech Stack:** React Native, react-native-reanimated (fade/spring animations), @shopify/react-native-skia (CardFace), TypeScript strict, @dabb/i18n

---

## File Map

| File                                                   | Action | Purpose                                            |
| ------------------------------------------------------ | ------ | -------------------------------------------------- |
| `packages/i18n/src/types.ts`                           | Modify | Add `goOutLink: string` to `TranslationKeys.game`  |
| `packages/i18n/src/locales/de.ts`                      | Modify | `goOutLink: 'Abgehen...'`                          |
| `packages/i18n/src/locales/en.ts`                      | Modify | `goOutLink: 'Go out...'`                           |
| `packages/game-canvas/src/overlays/DiscardOverlay.tsx` | Create | Scrim + card-slot dialog + inline Go Out flow      |
| `packages/game-canvas/index.ts`                        | Modify | Export `DiscardOverlay`                            |
| `apps/client/src/components/game/PlayerHand.tsx`       | Modify | Replace discard-mode props with slot-mode props    |
| `packages/game-canvas/src/overlays/DabbOverlay.tsx`    | Modify | Remove discard step; take-only                     |
| `apps/client/src/components/ui/GameScreen.tsx`         | Modify | Replace state/handlers, add DiscardOverlay, rewire |

---

### Task 1: Add i18n key

**Files:**

- Modify: `packages/i18n/src/types.ts` (after line 122)
- Modify: `packages/i18n/src/locales/de.ts` (after `goOut:`)
- Modify: `packages/i18n/src/locales/en.ts` (after `goOut:`)

- [ ] **Step 1: Add key to type definition**

In `packages/i18n/src/types.ts`, add after `goOutConfirmMessage: string;` (line 122):

```typescript
goOutLink: string;
```

- [ ] **Step 2: Add German translation**

In `packages/i18n/src/locales/de.ts`, add after `goOut: 'Abgehen',`:

```typescript
    goOutLink: 'Abgehen...',
```

- [ ] **Step 3: Add English translation**

In `packages/i18n/src/locales/en.ts`, add after `goOut: 'Go out',`:

```typescript
    goOutLink: 'Go out...',
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @dabb/i18n run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/en.ts
git commit -m "feat(i18n): add goOutLink translation key"
```

---

### Task 2: Create DiscardOverlay and export it

**Files:**

- Create: `packages/game-canvas/src/overlays/DiscardOverlay.tsx`
- Modify: `packages/game-canvas/index.ts`

- [ ] **Step 1: Create the component**

Create `packages/game-canvas/src/overlays/DiscardOverlay.tsx` with the full implementation:

```tsx
/**
 * DiscardOverlay — card-slot discard UI.
 *
 * Renders a dim scrim + floating dialog with `discardCount` card slots.
 * Tap a slotted card to return it to hand. Confirm with Ablegen once
 * all slots are filled. "Abgehen..." link reveals inline Go Out flow.
 *
 * The scrim is visual-only (pointerEvents="none") so hand taps pass through.
 * Rendered as a direct child of gameWrapper in GameScreen (not inside PhaseOverlay).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Card, CardId, Suit } from '@dabb/shared-types';
import { SUITS } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';
import { CardFace } from '../cards/CardFace.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DiscardOverlayProps {
  visible: boolean;
  discardCount: number;
  slottedCardIds: CardId[];
  onRemoveFromSlot: (cardId: CardId) => void;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function DiscardOverlay({
  visible,
  discardCount,
  slottedCardIds,
  onRemoveFromSlot,
  onDiscard,
  onGoOut,
}: DiscardOverlayProps) {
  const { t } = useTranslation();
  const [showGoOut, setShowGoOut] = useState(false);
  const [pendingSuit, setPendingSuit] = useState<Suit | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);
  const scale = useSharedValue(0.92);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-20, { duration: 180 });
      scale.value = withTiming(0.95, { duration: 180 });
      setPendingSuit(null);
      setShowGoOut(false);
    }
  }, [visible]);

  if (!visible) return null;

  const canDiscard = slottedCardIds.length === discardCount;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim scrim — visual only, taps pass through to PlayerHand */}
      <View style={styles.scrim} pointerEvents="none" />

      {/* Floating dialog */}
      <AnimatedView style={[styles.dialog, animatedStyle]} pointerEvents="auto">
        <Text style={styles.title}>{t('game.discardCards')}</Text>

        {/* Card slots */}
        <View style={styles.slotRow}>
          {Array.from({ length: discardCount }, (_, i) => {
            const cardId = slottedCardIds[i];
            return (
              <HapticTouchableOpacity
                key={i}
                style={styles.slot}
                onPress={() => cardId && onRemoveFromSlot(cardId)}
                disabled={!cardId}
              >
                {cardId ? (
                  <CardFace card={cardId} width={CARD_WIDTH} height={CARD_HEIGHT} />
                ) : (
                  <Text style={styles.slotNumber}>{i + 1}</Text>
                )}
              </HapticTouchableOpacity>
            );
          })}
        </View>

        {/* Counter */}
        <Text style={styles.counter}>
          {slottedCardIds.length} / {discardCount}
        </Text>

        {/* Ablegen button */}
        <HapticTouchableOpacity
          style={[styles.primaryButton, !canDiscard && styles.primaryButtonDisabled]}
          onPress={onDiscard}
          disabled={!canDiscard}
        >
          <Text style={styles.primaryButtonText}>{t('game.discard')}</Text>
        </HapticTouchableOpacity>

        <View style={styles.divider} />

        {/* Go Out section */}
        {!showGoOut ? (
          <HapticTouchableOpacity onPress={() => setShowGoOut(true)}>
            <Text style={styles.goOutLink}>{t('game.goOutLink')}</Text>
          </HapticTouchableOpacity>
        ) : pendingSuit === null ? (
          <>
            <Text style={styles.goOutLabel}>{t('game.orGoOut')}</Text>
            <View style={styles.suitRow}>
              {SUITS.map((suit) => (
                <HapticTouchableOpacity
                  key={suit}
                  style={[styles.suitButton, { backgroundColor: getSuitColor(suit) }]}
                  onPress={() => setPendingSuit(suit)}
                >
                  <Text style={styles.suitButtonText}>{SUIT_SYMBOLS[suit]}</Text>
                </HapticTouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.confirmTitle}>
              {t('game.goOutConfirmTitle')} {SUIT_SYMBOLS[pendingSuit]}
            </Text>
            <Text style={styles.confirmMessage}>{t('game.goOutConfirmMessage')}</Text>
            <View style={styles.confirmRow}>
              <HapticTouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPendingSuit(null)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </HapticTouchableOpacity>
              <HapticTouchableOpacity
                style={[styles.suitButton, { backgroundColor: getSuitColor(pendingSuit) }]}
                onPress={() => {
                  onGoOut(pendingSuit);
                  setPendingSuit(null);
                  setShowGoOut(false);
                }}
              >
                <Text style={styles.suitButtonText}>{t('game.goOut')}</Text>
              </HapticTouchableOpacity>
            </View>
          </>
        )}
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dialog: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    zIndex: 100,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 14,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  slot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8b6914',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 105, 20, 0.08)',
  },
  slotNumber: {
    fontSize: 18,
    color: '#c8b090',
    fontWeight: '300',
  },
  counter: {
    fontSize: 13,
    color: '#7a6040',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#8b6914',
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#bfae90',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#c8b090',
    width: '100%',
    marginVertical: 12,
  },
  goOutLink: {
    fontSize: 13,
    color: '#7a6040',
    textDecorationLine: 'underline',
  },
  goOutLabel: {
    fontSize: 13,
    color: '#7a6040',
    marginBottom: 8,
  },
  suitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suitButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 12,
    color: '#7a6040',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#c8b090',
  },
  cancelButtonText: {
    color: '#3a2800',
    fontWeight: '600',
    fontSize: 13,
  },
});
```

- [ ] **Step 2: Export from game-canvas index**

In `packages/game-canvas/index.ts`, add after the `DabbOverlay` export lines (35–36):

```typescript
export { DiscardOverlay } from './src/overlays/DiscardOverlay.js';
export type { DiscardOverlayProps } from './src/overlays/DiscardOverlay.js';
```

- [ ] **Step 3: Verify game-canvas builds**

```bash
pnpm --filter @dabb/game-canvas run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/overlays/DiscardOverlay.tsx packages/game-canvas/index.ts
git commit -m "feat(game-canvas): add DiscardOverlay with card slots and inline go-out flow"
```

---

### Task 3: Update PlayerHand, DabbOverlay, and GameScreen

> **Note:** These three files must change together — PlayerHand removes the old discard props, DabbOverlay removes the discard step, and GameScreen stops passing the now-deleted props to both. Verify the full build once at the end of this task.

**Files:**

- Modify: `apps/client/src/components/game/PlayerHand.tsx`
- Modify: `packages/game-canvas/src/overlays/DabbOverlay.tsx`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`

#### 3a — Update PlayerHand

- [ ] **Step 1: Replace the props interface and function signature**

In `PlayerHand.tsx`, replace lines 20–38 (the `PlayerHandProps` interface **and** the `export function PlayerHand({...})` signature together — both blocks need to change):

```tsx
export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string, dropPos?: { x: number; y: number }) => void;
  effects?: SkiaEffects;
  slottedCardIds?: string[];
  onSlotCard?: (cardId: string) => void;
}

export function PlayerHand({
  gameState,
  playerIndex: _playerIndex,
  cards,
  onPlayCard,
  effects,
  slottedCardIds,
  onSlotCard,
}: PlayerHandProps) {
```

- [ ] **Step 2: Replace `liftOffset` and `isDiscardMode` variable declarations**

In `PlayerHand.tsx`, replace lines 67–72 (the `liftOffset` and `isDiscardMode` variable declarations):

```tsx
// before:
  const liftOffset = 20 * cardScale;

  const isTricksPhase = gameState.phase === 'tricks';
  const isTrumpHighlightPhase = ...
  const isDiscardMode = !!onToggleDiscard;

// after — remove liftOffset and rename isDiscardMode:
  const isTricksPhase = gameState.phase === 'tricks';
  const isTrumpHighlightPhase =
    (gameState.phase === 'tricks' || gameState.phase === 'melding') && gameState.trump !== null;
  const isSlotMode = !!onSlotCard;
```

Exact replacement: remove `const liftOffset = 20 * cardScale;` (line 67) and replace `const isDiscardMode = !!onToggleDiscard;` (line 72) with `const isSlotMode = !!onSlotCard;`.

- [ ] **Step 3: Replace the `if (isDiscardMode)` render branch**

In `PlayerHand.tsx`, replace the entire `if (isDiscardMode) { ... }` block inside `sortedCards.map` (lines 98–119) with:

```tsx
if (isSlotMode) {
  if (slottedCardIds?.includes(card.id)) {
    return null; // card is in a slot; hide from hand
  }
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
      highlighted={highlightedIds.has(card.id)}
      isTrump={false}
      onTap={() => {
        playSound('card-select');
        triggerHaptic('card-select');
        onSlotCard!(card.id);
      }}
    />
  );
}
```

#### 3b — Simplify DabbOverlay

- [ ] **Step 3: Replace DabbOverlay with take-only version**

Replace the entire contents of `packages/game-canvas/src/overlays/DabbOverlay.tsx` with:

```tsx
/**
 * DabbOverlay — take-dabb UI.
 *
 * Shows the dabb cards face-down, flips them one by one on mount,
 * then lets the bid winner take them. The discard step has been
 * moved to DiscardOverlay.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Card } from '@dabb/shared-types';
import { FlippableCard } from '../cards/FlippableCard.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DabbOverlayProps {
  visible: boolean;
  dabbCards: Card[];
  onTake: () => void;
}

export function DabbOverlay({ visible, dabbCards, onTake }: DabbOverlayProps) {
  const { t } = useTranslation();
  const [flippedCount, setFlippedCount] = useState(0);
  const [instant, setInstant] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardCount = dabbCards.length;

  useEffect(() => {
    if (!visible) return;
    setFlippedCount(0);
    setInstant(false);
    timers.current = Array.from({ length: cardCount }, (_, i) =>
      setTimeout(() => setFlippedCount(i + 1), 400 + i * 300)
    );
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [visible, cardCount]);

  function handleTake() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFlippedCount(cardCount);
    setInstant(true);
    onTake();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('game.takeDabb')}</Text>
      <View style={styles.cardRow}>
        {dabbCards.map((card, i) => (
          <View key={card.id} style={styles.cardWrapper}>
            <FlippableCard
              card={card}
              flipped={flippedCount > i}
              instant={instant}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            />
          </View>
        ))}
      </View>
      <HapticTouchableOpacity style={styles.primaryButton} onPress={handleTake}>
        <Text style={styles.primaryButtonText}>{t('game.takeDabb')}</Text>
      </HapticTouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 280,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primaryButton: {
    backgroundColor: '#8b6914',
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
```

#### 3c — Update GameScreen

- [ ] **Step 4: Update import line**

In `GameScreen.tsx`, replace the `@dabb/game-canvas` import (line 10–18) to add `DiscardOverlay` and remove unused names:

```typescript
import {
  GameTable,
  useSkiaEffects,
  PhaseOverlay,
  BiddingOverlay,
  DabbOverlay,
  DiscardOverlay,
  TrumpOverlay,
  MeldingOverlay,
  edgeFraction,
} from '@dabb/game-canvas';
```

- [ ] **Step 5: Replace dabb state and handlers**

In `GameScreen.tsx`, replace line 184:

```typescript
const [dabbSelectedCards, setDabbSelectedCards] = useState<string[]>([]);
```

with:

```typescript
const [slottedCardIds, setSlottedCardIds] = useState<string[]>([]);
```

Replace lines 277–291 (which include `dabbStep`, `dabbCards`, `handleToggleDabbCard`, and `handleDiscard` — **all four** must be removed/replaced) with:

```typescript
// Discard slot state handlers
const discardCount = DABB_SIZE[state.playerCount];

const handleSlotCard = useCallback(
  (cardId: string) => {
    setSlottedCardIds((prev) => {
      if (prev.length >= discardCount || prev.includes(cardId)) return prev;
      return [...prev, cardId];
    });
  },
  [discardCount]
);

const handleRemoveFromSlot = useCallback((cardId: string) => {
  setSlottedCardIds((prev) => prev.filter((id) => id !== cardId));
}, []);

const handleDiscard = useCallback(() => {
  onDiscard(slottedCardIds);
  setSlottedCardIds([]);
}, [onDiscard, slottedCardIds]);
```

- [ ] **Step 6: Replace showDabb flag and add reset effect**

Replace line 338:

```typescript
const showDabb = state.phase === 'dabb' && isBidWinner;
```

with:

```typescript
const showDabbTake = state.phase === 'dabb' && isBidWinner && state.dabb.length > 0;
const showDiscard = state.phase === 'dabb' && isBidWinner && state.dabb.length === 0;
```

Add the reset effect directly after, before the `return` statement:

```typescript
// Reset slotted cards if discard phase exits unexpectedly (reconnect, phase advance)
useEffect(() => {
  if (!showDiscard) {
    setSlottedCardIds([]);
  }
}, [showDiscard]);
```

- [ ] **Step 7: Update PlayerHand in JSX**

Replace lines 403–420 (the `<PlayerHand ... />` block):

```tsx
<PlayerHand
  gameState={state}
  playerIndex={playerIndex}
  cards={myCards}
  onPlayCard={(cardId, dropPos) => {
    if (dropPos) {
      setLastDropPos(dropPos);
    }
    onPlayCard(cardId);
  }}
  effects={effects}
  slottedCardIds={showDiscard ? slottedCardIds : undefined}
  onSlotCard={showDiscard ? handleSlotCard : undefined}
/>
```

- [ ] **Step 8: Replace DabbOverlay usage in JSX**

Replace lines 432–443 (the `<PhaseOverlay visible={showDabb}>` block):

```tsx
<PhaseOverlay visible={showDabbTake}>
  <DabbOverlay visible={showDabbTake} dabbCards={state.dabb} onTake={onTakeDabb} />
</PhaseOverlay>
```

- [ ] **Step 9: Add DiscardOverlay to JSX**

Add the following block directly after the closing `</PhaseOverlay>` for DabbOverlay (after the newly replaced block from Step 8), before the TrumpOverlay PhaseOverlay:

```tsx
<DiscardOverlay
  visible={showDiscard}
  discardCount={discardCount}
  slottedCardIds={slottedCardIds}
  onRemoveFromSlot={handleRemoveFromSlot}
  onDiscard={handleDiscard}
  onGoOut={onGoOut}
/>
```

- [ ] **Step 10: Verify the full build**

```bash
pnpm run build
```

Expected: exits 0, no TypeScript errors across all packages.

- [ ] **Step 11: Run tests**

```bash
pnpm test
```

Expected: all tests pass (no game-logic tests are affected).

- [ ] **Step 12: Commit**

```bash
git add \
  apps/client/src/components/game/PlayerHand.tsx \
  packages/game-canvas/src/overlays/DabbOverlay.tsx \
  apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat(client): redesign discard UI with card slots and floating dialog"
```

---

### Task 4: Full CI check

- [ ] **Step 1: Run the CI suite**

```bash
pnpm run build && pnpm test && pnpm lint
```

Expected: all three pass with no errors or warnings.

If lint reports auto-fixable issues:

```bash
pnpm lint:fix
git add packages/game-canvas/src/overlays/DiscardOverlay.tsx \
  packages/game-canvas/src/overlays/DabbOverlay.tsx \
  apps/client/src/components/game/PlayerHand.tsx \
  apps/client/src/components/ui/GameScreen.tsx
git commit -m "style: fix lint warnings after discard UI redesign"
```
