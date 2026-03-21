# Dabb Card Flip Animation — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

When the dabb overlay opens during the take phase, the two dabb cards are currently shown as permanent card backs. This spec adds a one-by-one flip animation that reveals the card faces automatically, matching the excitement of the moment.

## User Experience

1. The dabb overlay appears showing two card backs (unchanged entrance animation).
2. After a short delay (~400ms, allowing the overlay entrance to settle), the first card flips to its face automatically.
3. ~300ms later, the second card flips.
4. The Take button is always visible and enabled throughout. Pressing it at any point cancels pending animations, snaps any unflipped cards immediately to face-up, and proceeds to the discard phase.

## Architecture

### New component: `FlippableCard`

Location: `packages/game-canvas/src/cards/FlippableCard.tsx`

A controlled component that wraps `CardBack` and `CardFace`. It accepts a `flipped: boolean` prop. When `flipped` transitions from `false` to `true`, it plays the rotateY flip animation. When already `true` on mount (cancel case), it renders the face immediately with no animation.

Props:

```typescript
interface FlippableCardProps {
  card: Card;
  flipped: boolean;
  width: number;
  height: number;
}
```

### `DabbOverlay` changes

The `take` step gains internal state `flippedCount: 0 | 1 | 2` (starts at 0).

On mount in the take step, two timeouts sequence the flips:

- Card 1: `flipped = true` at +400ms
- Card 2: `flipped = true` at +700ms

The Take button handler:

1. Clears both pending timeouts.
2. Sets `flippedCount = 2` (snaps all cards to face-up immediately).
3. Calls the original `onTake()`.

## Animation Details

Each `FlippableCard` uses a single Reanimated shared value `rotateY` (degrees) and a JS state boolean `showFace` to control which canvas is rendered mid-flip.

**Flip sequence (total: ~200ms per card):**

1. `rotateY`: 0° → 90° in 100ms — `Easing.in(Easing.cubic)` — card rotates away
2. At 90° (edge-on, visually invisible): `runOnJS` sets `showFace = true`, swapping CardBack → CardFace
3. `rotateY`: -90° → 0° in 100ms — `Easing.out(Easing.cubic)` — face rotates in

Implemented with `withSequence(withTiming(...), withTiming(...))` on the shared value, and a `useAnimatedReaction` (or callback in the sequence) to trigger the face swap at the midpoint.

**Perspective:** 800 on the wrapping Animated view — realistic depth without distortion.

**Cancel behavior:** When Take is pressed mid-animation, `cancelAnimation(rotateY)` stops the shared value, `rotateY.value` is snapped to 0, and `showFace` is set to `true` — instant reveal, no half-flip visual glitch.

**Timing summary:**

| Event                     | Time from overlay open |
| ------------------------- | ---------------------- |
| Overlay entrance complete | ~220ms                 |
| Card 1 starts flipping    | +400ms                 |
| Card 1 flip complete      | +600ms                 |
| Card 2 starts flipping    | +700ms                 |
| Card 2 flip complete      | +900ms                 |

## Testing

`FlippableCard` is a pure animation component — no unit tests needed (Vitest cannot test animation sequences). No existing `DabbOverlay` tests exist.

Manual verification:

- Cards flip in sequence on overlay open
- Take button always works; cancels animations and reveals faces cleanly
- No half-flip visual glitch on cancel (pressing Take mid-animation)
- Correct behaviour on web and native (Reanimated and Skia both support both targets)
