# Dabb Card Flip Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sequential card-flip animation to the dabb overlay's take step, revealing each card face one by one after a short delay, with the Take button always available to cancel and proceed instantly.

**Architecture:** A new `FlippableCard` component handles the 3D rotateY flip animation (Reanimated shared value + `withSequence`), controlled by a `flipped` boolean and an `instant` boolean for immediate snapping. `DabbOverlay` manages two `setTimeout` calls to sequence the flips and clears them when Take is pressed.

**Tech Stack:** React Native Reanimated v4 (`useSharedValue`, `withSequence`, `withTiming`, `cancelAnimation`, `useAnimatedReaction`), `runOnJS` from `react-native-worklets`, React Native Animated.View (wrapping Skia Canvas cards).

---

## File Map

| Action | File                                                | Purpose                                               |
| ------ | --------------------------------------------------- | ----------------------------------------------------- |
| Create | `packages/game-canvas/src/cards/FlippableCard.tsx`  | Controlled card-flip component with rotateY animation |
| Modify | `packages/game-canvas/src/overlays/DabbOverlay.tsx` | Add flip sequencing and cancel-on-take logic          |

---

## Task 1: Create FlippableCard component

**Files:**

- Create: `packages/game-canvas/src/cards/FlippableCard.tsx`

- [ ] **Step 1: Create the file with full implementation**

```typescript
/**
 * FlippableCard — a card that animates from back to face via a rotateY flip.
 *
 * When flipped transitions false→true (and instant=false), plays a 200ms 3D flip.
 * When instant=true, snaps immediately to face-up (cancels any in-progress animation).
 * When flipped is already true on mount, renders face immediately (no animation).
 */
import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import type { Card } from '@dabb/shared-types';
import { CardBack } from './CardBack.js';
import { CardFace } from './CardFace.js';

export interface FlippableCardProps {
  card: Card; // card.id is passed to CardFace internally
  flipped: boolean;
  instant: boolean; // when true, snaps to face without animation
  width: number;
  height: number;
}

export function FlippableCard({ card, flipped, instant, width, height }: FlippableCardProps) {
  // showFace drives which canvas is rendered; starts true if already flipped on mount
  const [showFace, setShowFace] = useState(flipped);
  const rotateY = useSharedValue(0);
  // Prevent re-triggering animation if already fired
  const hasFlipped = useRef(flipped);

  // Swap content at the midpoint of the flip (card edge-on at 90°)
  useAnimatedReaction(
    () => rotateY.value,
    (current, previous) => {
      if (previous !== null && previous < 90 && current >= 90) {
        runOnJS(setShowFace)(true);
      }
    },
  );

  useEffect(() => {
    if (!flipped) return;

    if (instant) {
      // Cancel any in-progress flip and reveal face immediately
      cancelAnimation(rotateY);
      rotateY.value = 0;
      setShowFace(true);
      hasFlipped.current = true;
      return;
    }

    if (hasFlipped.current) return; // already animated or already face-up on mount
    hasFlipped.current = true;

    // Phase 1: back rotates to edge (0° → 90°, 100ms)
    // Instant jump to -90° (zero-duration timing)
    // Phase 2: face rotates in from the other side (-90° → 0°, 100ms)
    // Content swap happens via useAnimatedReaction when rotateY passes through 90°.
    rotateY.value = withSequence(
      withTiming(90, { duration: 100, easing: Easing.in(Easing.cubic) }),
      withTiming(-90, { duration: 0 }), // instant jump to start of face-reveal phase
      withTiming(0, { duration: 100, easing: Easing.out(Easing.cubic) }),
    );
  }, [flipped, instant, rotateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width, height }, animatedStyle]}>
      {/* Both children are position:absolute — wrapper provides the bounding box */}
      <View style={{ width, height }}>
        {!showFace && <CardBack width={width} height={height} />}
        {showFace && <CardFace card={card.id} width={width} height={height} />}
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd /home/deglerj/Dokumente/Git/dabb && pnpm --filter @dabb/game-canvas run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/game-canvas/src/cards/FlippableCard.tsx
git commit -m "feat(game-canvas): add FlippableCard component with rotateY flip animation"
```

---

## Task 2: Wire FlippableCard into DabbOverlay

**Files:**

- Modify: `packages/game-canvas/src/overlays/DabbOverlay.tsx`

- [ ] **Step 1: Replace the take-step rendering in DabbOverlay**

Open `packages/game-canvas/src/overlays/DabbOverlay.tsx`. Make these changes:

**Add imports** (after existing imports at top of file):

```typescript
import React, { useEffect, useRef, useState } from 'react';
```

> Note: `React` is already imported. Add `useEffect`, `useRef`, `useState` to the existing React import.

**Remove** the `CardBack` import line (it is no longer used directly in `DabbOverlay` — `FlippableCard` uses it internally):

```typescript
// DELETE this line:
import { CardBack } from '../cards/CardBack.js';
```

**Add** the `FlippableCard` import in its place:

```typescript
import { FlippableCard } from '../cards/FlippableCard.js';
```

**Replace the existing `export function DabbOverlay(...)` signature + body up through the `take` step rendering.** The full new component (only the function body and signature change — styles are unchanged):

```typescript
export function DabbOverlay({
  step,
  dabbCards,
  discardCount,
  selectedCardIds,
  onTake,
  onDiscard,
  onGoOut,
}: DabbOverlayProps) {
  const { t } = useTranslation();
  const canDiscard = selectedCardIds.length === discardCount;

  // Track how many dabb cards have auto-flipped (0, 1, or 2)
  const [flippedCount, setFlippedCount] = useState<0 | 1 | 2>(0);
  // When true, any pending or in-progress flip is cancelled and cards snap to face
  const [instant, setInstant] = useState(false);
  const timer1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'take') return;
    // Reset state when overlay re-opens
    setFlippedCount(0);
    setInstant(false);
    timer1.current = setTimeout(() => setFlippedCount(1), 400);
    timer2.current = setTimeout(() => setFlippedCount(2), 700);
    return () => {
      if (timer1.current) clearTimeout(timer1.current);
      if (timer2.current) clearTimeout(timer2.current);
    };
  }, [step]);

  function handleTake() {
    if (timer1.current) clearTimeout(timer1.current);
    if (timer2.current) clearTimeout(timer2.current);
    setFlippedCount(2);
    setInstant(true);
    onTake();
  }

  return (
    <View style={styles.container}>
      {step === 'take' ? (
        <>
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
        </>
      ) : (
```

> Everything from the `} : (` onward (the discard step JSX and closing tags) stays **exactly as-is**. Only the import line, the state/effect additions, and the take-step JSX change.

- [ ] **Step 2: Verify the build compiles cleanly**

```bash
cd /home/deglerj/Dokumente/Git/dabb && pnpm run build
```

Expected: zero TypeScript errors across all packages.

- [ ] **Step 3: Commit**

```bash
git add packages/game-canvas/src/overlays/DabbOverlay.tsx
git commit -m "feat(game-canvas): flip dabb cards one-by-one when overlay opens"
```

---

## Task 3: CI verification

- [ ] **Step 1: Run full CI check**

```bash
cd /home/deglerj/Dokumente/Git/dabb && pnpm run build && pnpm test && pnpm lint
```

Expected: all pass with no errors.

- [ ] **Step 2: Manual verification checklist**

Open the app (web: `pnpm --filter @dabb/client start`) and play to the dabb phase:

- [ ] Card backs shown when overlay opens
- [ ] First card flips ~400ms after overlay appears
- [ ] Second card flips ~300ms after first
- [ ] Take button always visible and enabled throughout
- [ ] Pressing Take before flip sequence finishes: remaining cards snap to face immediately, no half-flip glitch
- [ ] Pressing Take after both cards have flipped: works normally
