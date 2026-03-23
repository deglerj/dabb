# Hand Two-Row Layout — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Problem

On narrow mobile devices, the player's hand cards are too small to read. The current algorithm scales all cards down uniformly to fit every card in a single row. With 12 cards on a 375 px screen the scale factor drops to ~0.57, producing cards only ~40 px wide.

## Solution

When the screen is narrow and the hand exceeds a configurable maximum cards-per-row, overflow cards wrap to a second row above the first. Each row fans independently, bottom row cards render in front of top row cards, and the two rows overlap slightly so the hand looks cohesive.

## Trigger Conditions

Two-row mode activates when **both** hold:

- `width < MOBILE_BREAKPOINT_WIDTH` (default **480 px**)
- `n > MAX_CARDS_PER_ROW` (default **10**)

On wide screens, or when the hand is short enough, the existing single-row path runs unchanged.

## Constants (all in `cardPositions.ts`)

```typescript
const MOBILE_BREAKPOINT_WIDTH = 480; // px — below this, two-row mode can activate
const MAX_CARDS_PER_ROW = 10; // max cards on the bottom row before overflow
const ROW_OVERLAP = 0.4; // fraction of card height the rows overlap
```

## Layout Algorithm

```
isTwoRowMode = width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW

if isTwoRowMode:
  bottomIds = handCardIds[0 .. MAX_CARDS_PER_ROW - 1]   // first N sorted cards
  topIds    = handCardIds[MAX_CARDS_PER_ROW .. n - 1]    // overflow

  // Scale driven by the bottom row (more cards → more constrained)
  cardScale = min(1, availableWidth / naturalWidth(bottomIds))

  // Bottom row — same formula as today, for bottomIds only
  bottomY = height - scaledH - HAND_BOTTOM_MARGIN
  position each card left-to-right, centered, fan rotation around row midpoint

  // Top row — overlaps bottom row by ROW_OVERLAP of card height
  topY = bottomY - scaledH * (1 - ROW_OVERLAP)   // = bottomY - 0.6 · scaledH
  position topIds left-to-right, independently centered, fan around top row midpoint

  // Z-indices: bottom row always renders in front of top row
  top row cards:    zIndex = i                (0 … topCount − 1)
  bottom row cards: zIndex = topCount + i     (topCount … n − 1)
```

**Shared scale:** Both rows use the same `cardScale` (derived from the bottom row). This keeps `PlayerHand.tsx` unchanged — it still computes `scaledW`, `scaledH`, and `liftOffset` from the single `cardScale` value.

**Discard lift:** The existing `pos.y - liftOffset` behaviour for selected cards in discard mode continues to work. Top-row selected cards lift upward toward the playing field, which is acceptable.

## Interface Changes

`CardPositionsOutput` is **unchanged**. Top-row cards simply receive a smaller `y` value; no consumer needs to know which row a card is on.

`CardPositionsInput` is **unchanged**.

`PlayerHand.tsx` is **unchanged**.

## Files Changed

| File                                                   | Change                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`      | Add three constants; add two-row branch in `deriveCardPositions` |
| `packages/game-canvas/__tests__/cardPositions.test.ts` | Update one existing test; add nine new two-row tests             |

## Tests

### Existing test — unchanged behaviour

- `scales down when 12 cards overflow a 375px portrait phone` — still passes; 10-card bottom row on 375 px still scales below 1.

### New tests

1. **Two-row mode activates** — 375 px, 11 cards → bottom row has 10 cards, top row has 1
2. **Two-row mode does not activate on wide screen** — 800 px, 11 cards → single row (all cards share the same `y`)
3. **Two-row mode does not activate when cards ≤ MAX_CARDS_PER_ROW** — 375 px, 10 cards → single row
4. **Bottom row contains first N cards** — indices 0–9 have the larger `y` value
5. **Top row contains overflow cards** — indices 10+ have the smaller `y` value
6. **Rows overlap by ROW_OVERLAP fraction** — `topY === bottomY - scaledH * (1 - ROW_OVERLAP)` (within float tolerance)
7. **Bottom row z-index > top row z-index** — every bottom row card has strictly higher `zIndex` than every top row card
8. **Each row is independently centered** — midpoint x of each row ≈ `width / 2`
9. **Each row fans independently** — rotation is symmetric around each row's own midpoint (first and last card in each row have equal-magnitude, opposite-sign rotations)
