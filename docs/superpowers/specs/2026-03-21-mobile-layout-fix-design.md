# Mobile Layout Fix Design

**Date:** 2026-03-21
**Status:** Approved

## Problem

Three distinct layout bugs make the game unusable on mobile phones:

1. **Portrait – hand overflows screen width.** `cardPositions.ts` uses fixed `CARD_WIDTH=70` and `CARD_OVERLAP=22`. A full hand of 12 cards requires 598px, which overflows a ~375px phone screen. Cards are not scrollable or draggable off-screen.
2. **Landscape – hand cut off at bottom.** `HAND_Y_FRACTION=0.82` places cards at `0.82×height + 105px`. On a landscape phone (height≈375px) that's 412px — 37px off screen.
3. **Landscape – phase dialogs overflow and cover cards.** `PhaseOverlay` is anchored at `top: '28%'` with no max-height constraint. The DabbOverlay discard step (cards + buttons + go-out section) is ~300px tall, overflowing the screen and obscuring the hand.

## Scope

- **Native (Android/iOS):** Lock to portrait — eliminates landscape problems entirely on devices.
- **Web:** Apply card scaling and overlay constraints — handles any browser viewport size.
- Landscape on web: "functional" is acceptable, not a polished experience.

## Solution

### 1. Portrait lock (native only)

Set `"orientation": "portrait"` in `apps/client/app.json`. Expo enforces this at the OS level. No runtime code needed.

**File:** `apps/client/app.json`

### 2. Dynamic card scaling

`deriveCardPositions` in `cardPositions.ts` computes a continuous scale factor based on available screen width and card count:

```
HAND_SIDE_MARGIN = 16  (px of breathing room on each side)
naturalWidth = n * CARD_WIDTH - (n-1) * CARD_OVERLAP
cardScale = min(1.0, (screenWidth - 2 * HAND_SIDE_MARGIN) / naturalWidth)
scaledW = CARD_WIDTH * cardScale
scaledH = CARD_HEIGHT * cardScale
handY = screenHeight - scaledH - 10   (bottom-anchored, 10px above edge)
```

The function returns `cardScale` alongside the existing position maps. `PlayerHand` reads `cardScale` and passes `scaledW`/`scaledH` to each `CardView` (which already accepts `width` and `height` props).

Example scale values:

- 375px phone, 12 cards → ~0.58 (small but legible)
- 430px phone, 12 cards → ~0.67
- Tablet / desktop web → 1.0 (full size, unchanged)

The bottom-anchored `handY` also fixes the landscape cutoff on web (hand always sits 10px above the bottom edge regardless of screen height).

**Files:** `packages/game-canvas/src/cards/cardPositions.ts`, `apps/client/src/components/game/PlayerHand.tsx`

### 3. Overflow-safe PhaseOverlay

Two additions to `PhaseOverlay.tsx`:

- `maxHeight: '70%'` on the `paper` style — overlay can never exceed 70% of screen height.
- `children` wrapped in a vertical `ScrollView` (with `showsVerticalScrollIndicator={false}`) inside the paper `View` — content that exceeds max-height scrolls within the dialog rather than overflowing.

Only the dialog's internal content scrolls. The game table is unaffected.

**File:** `packages/game-canvas/src/overlays/PhaseOverlay.tsx`

### 4. Prevent game screen scroll (web)

Add `overflow: 'hidden'` to the root `View` style in `GameScreen.tsx`. On native this is a no-op; on web it prevents the browser from making the page scrollable even if content technically overflows.

**File:** `apps/client/src/components/ui/GameScreen.tsx`

## Files Changed

| File                                                 | Change                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| `apps/client/app.json`                               | Add `"orientation": "portrait"`             |
| `packages/game-canvas/src/cards/cardPositions.ts`    | Dynamic card scale + bottom-anchored hand Y |
| `apps/client/src/components/game/PlayerHand.tsx`     | Pass scaled card dimensions to CardView     |
| `packages/game-canvas/src/overlays/PhaseOverlay.tsx` | maxHeight + ScrollView wrapper              |
| `apps/client/src/components/ui/GameScreen.tsx`       | overflow: hidden on root View               |

## Out of Scope

- Landscape polish on web (portrait lock handles native; web landscape is "functional")
- Tablet-specific layouts
- Any changes to opponent zones, trick animation, or scoreboard
