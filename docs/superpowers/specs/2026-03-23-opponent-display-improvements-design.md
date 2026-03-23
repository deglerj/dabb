# Opponent Display Improvements

**Date:** 2026-03-23
**Status:** Approved

## Overview

Two independent improvements to how opponents are shown on the game table:

1. **Spread opponents across the full top edge** — replace hardcoded pixel positions with a responsive edge-push formula that works on any screen size.
2. **Show the textured card back** — replace the plain green `View` stubs with the existing `CardBack` Skia component, keeping the look consistent with the player's own cards.

## Decisions Made

| Question                                    | Decision                                            |
| ------------------------------------------- | --------------------------------------------------- |
| Portrait phone — count badge or card backs? | Remove count badge entirely; show name chip only    |
| Distribution formula                        | Edge-push: 15 %–85 % range                          |
| Card back rendering                         | Wrap existing `CardBack` in a small Skia `<Canvas>` |

---

## 1 · Opponent Positioning

### Problem

`GameScreen.tsx` positions `OpponentZone` components with hardcoded pixel coordinates (e.g. `{ x: 100, y: 60 }`, `{ x: 260, y: 60 }`). On wide screens all opponents cluster in the top-left. Meanwhile `cardPositions.ts` already computes responsive positions using `width * (i + 1) / (n + 1)` for animation purposes — two separate systems that can drift.

### Solution: `edgeFraction` formula

Replace both formulas with a single `edgeFraction(i, n)` helper that maps opponent index `i` (0-based) over the range 15 %–85 % of the canvas width:

```typescript
function edgeFraction(i: number, n: number): number {
  const lo = 0.15,
    hi = 0.85;
  if (n === 1) return 0.5;
  return lo + (i / (n - 1)) * (hi - lo);
}
```

Results:

| Player count | Opponents | x positions      |
| ------------ | --------- | ---------------- |
| 2            | 1         | 50 %             |
| 3            | 2         | 15 %, 85 %       |
| 4            | 3         | 15 %, 50 %, 85 % |

The helper is defined once (in `cardPositions.ts` or a shared util) and used in both `cardPositions.ts` (animation origins) and `GameScreen.tsx` (visual zone placement), eliminating drift.

### Files changed

- `packages/game-canvas/src/cards/cardPositions.ts` — replace `(i + 1) / (n + 1)` with `edgeFraction`
- `apps/client/src/ui/GameScreen.tsx` — derive `OpponentZone` positions from `edgeFraction(i, n) * screenWidth`

---

## 2 · Card Back Rendering

### Problem

`OpponentZone.tsx` renders opponent card backs as plain `View` elements with `backgroundColor: '#2a6e3c'` (green). The actual card back texture — dark brown (`#5c2e0a`) with a white crosshatch overlay — already exists in `CardBack.tsx` (Skia `PictureRecorder`), but is only used inside the main Skia canvas.

### Solution: `CardBackView` wrapper

A new `CardBackView` component wraps a sized Skia `<Canvas>` around the existing `CardBack` drawing:

```typescript
// packages/game-canvas/src/cards/CardBackView.tsx
export function CardBackView({ width, height }: { width: number; height: number }) {
  return (
    <Canvas style={{ width, height }}>
      <CardBack width={width} height={height} />
    </Canvas>
  );
}
```

`CardBack` already caches its rendered picture via `PictureRecorder`, so creating 4–6 instances per opponent is inexpensive.

`OpponentZone.tsx` replaces its green `View` stubs with `CardBackView` instances. No changes to `CardBack.tsx` itself.

### Files changed

- `packages/game-canvas/src/cards/CardBackView.tsx` — **new file**
- `apps/client/src/components/game/OpponentZone.tsx` — swap green `View` for `CardBackView`

---

## 3 · Portrait Phone

On narrow portrait phones `OpponentZone` currently shows a card-count badge (number of cards in opponent's hand). This is removed — the count provides little useful information. Portrait mode shows **only the name chip** (opponent nickname). Landscape and tablet continue to show the card fan.

### Files changed

- `apps/client/src/components/game/OpponentZone.tsx` — remove `cardCountBadge` render path

---

## 4 · Animations

Trick card-flight animations use `opponentHands[id].x` from `cardPositions.ts` as the origin point. Since `cardPositions.ts` is updated to use `edgeFraction`, animation origins automatically follow the new visual positions. No separate animation changes are needed.

---

## 5 · Testing

The existing Vitest tests in `packages/game-canvas/src/__tests__/` that assert on opponent hand `x` positions must be updated to expect the new `edgeFraction` values (e.g. for 2 opponents: `0.15 * width` and `0.85 * width`).

---

## Summary of File Changes

| File                                               | Change                                             |
| -------------------------------------------------- | -------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`  | Replace even-split formula with `edgeFraction`     |
| `packages/game-canvas/src/cards/CardBackView.tsx`  | **New** — small Skia canvas wrapper for `CardBack` |
| `apps/client/src/components/game/OpponentZone.tsx` | Use `CardBackView`, remove count badge             |
| `apps/client/src/ui/GameScreen.tsx`                | Derive positions from `edgeFraction * screenWidth` |
| `packages/game-canvas/src/__tests__/`              | Update position assertions                         |
