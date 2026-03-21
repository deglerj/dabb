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

`deriveCardPositions` in `cardPositions.ts` computes a continuous scale factor based on available screen width and card count. Both card dimensions and spacing are scaled together so the fan layout stays proportionally correct.

Constants involved:

- `CARD_WIDTH = 70` (existing)
- `CARD_HEIGHT = 105` (add this constant alongside CARD_WIDTH)
- `CARD_OVERLAP = 22` (existing)
- `HAND_SIDE_MARGIN = 16` (new — px of breathing room on each side)

Computation:

```
naturalWidth = n * CARD_WIDTH - (n-1) * CARD_OVERLAP
cardScale    = min(1.0, (screenWidth - 2 * HAND_SIDE_MARGIN) / naturalWidth)

scaledW       = CARD_WIDTH   * cardScale
scaledH       = CARD_HEIGHT  * cardScale
scaledOverlap = CARD_OVERLAP * cardScale

handStartX = (screenWidth - (n * scaledW - (n-1) * scaledOverlap)) / 2
handY      = screenHeight - scaledH - 10   // top edge of card; bottom edge is 10px above screen bottom

x_i = handStartX + i * (scaledW - scaledOverlap)
```

`HAND_Y_FRACTION` (currently `0.82`) is no longer used and must be removed.

`cardScale` is added to `CardPositionsOutput` and returned from `deriveCardPositions`. `PlayerHand` reads it and passes `scaledW`/`scaledH` to each `CardView` (which already accepts `width` and `height` props for rendering). The `x` and `y` positions already encode the scaled geometry, so `CardView` receives correct `targetX`/`targetY` values directly.

In discard mode, `PlayerHand` lifts selected cards by a hard-coded `-20px`. This offset must also scale: `targetY = pos.y - 20 * cardScale` when a card is selected.

The bottom-anchored `handY` also fixes the landscape cutoff on web — hand always sits 10px above the bottom edge regardless of screen height.

Example scale values:

- 375px phone, 12 cards → ~0.58
- 430px phone, 12 cards → ~0.67
- Tablet / desktop web → 1.0 (full size, unchanged)

**Files:** `packages/game-canvas/src/cards/cardPositions.ts`, `apps/client/src/components/game/PlayerHand.tsx`

### 3. Overflow-safe PhaseOverlay

The `paper` style cannot use a percentage `maxHeight` reliably because its parent (`container` AnimatedView) has no explicit height, so the percentage would resolve against an unconstrained value. Instead, use `useWindowDimensions` inside `PhaseOverlay` to obtain the screen height and compute an absolute pixel cap:

```
maxPaperHeight = screenHeight * 0.70
```

Apply this as `maxHeight: maxPaperHeight` on the `paper` View.

Wrap `children` in a vertical `ScrollView` (with `showsVerticalScrollIndicator={false}`) inside the paper `View`, so content that exceeds the max height scrolls within the dialog rather than overflowing. Only the dialog's internal content scrolls; the game table and hand are unaffected.

**File:** `packages/game-canvas/src/overlays/PhaseOverlay.tsx`

### 4. Prevent game screen scroll (web)

Add `overflow: 'hidden'` to the root `View` style in `GameScreen.tsx`. On native this is a no-op. On web, the root layout (`_layout.tsx`) wraps everything in `GestureHandlerRootView` with `flex: 1`. Expo's web shell sets `height: 100%` on `html` and `body`, which anchors `flex: 1` to the viewport height. `overflow: 'hidden'` on `GameScreen`'s root View therefore prevents browser page scroll. If this assumption ever changes, an explicit `height: '100vh'` on the web shell would be the fallback.

**File:** `apps/client/src/components/ui/GameScreen.tsx`

## Files Changed

| File                                                 | Change                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/client/app.json`                               | Add `"orientation": "portrait"`                                                                                                                                          |
| `packages/game-canvas/src/cards/cardPositions.ts`    | Add `CARD_HEIGHT` constant; remove `HAND_Y_FRACTION`; dynamic card scale + bottom-anchored hand Y; update `CardPositionsOutput` interface to include `cardScale: number` |
| `apps/client/src/components/game/PlayerHand.tsx`     | Read `cardScale` from positions; pass scaled card dimensions to CardView; scale the discard-mode lift offset                                                             |
| `packages/game-canvas/src/overlays/PhaseOverlay.tsx` | Use `useWindowDimensions` for absolute maxHeight; ScrollView wrapper                                                                                                     |
| `apps/client/src/components/ui/GameScreen.tsx`       | `overflow: 'hidden'` on root View                                                                                                                                        |

## Out of Scope

- Landscape polish on web (portrait lock handles native; web landscape is "functional")
- Tablet-specific layouts
- Any changes to opponent zones, trick animation, or scoreboard
