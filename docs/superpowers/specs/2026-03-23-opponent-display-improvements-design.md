# Opponent Display Improvements

**Date:** 2026-03-23
**Status:** Approved

## Overview

Two independent improvements to how opponents are shown on the game table:

1. **Spread opponents across the full top edge** — replace hardcoded pixel positions with a responsive edge-push formula that works on any screen size.
2. **Show the textured card back** — replace the plain green `View` stubs with the existing `CardBack` component, keeping the look consistent with the player's own cards.

## Decisions Made

| Question                                    | Decision                                                      |
| ------------------------------------------- | ------------------------------------------------------------- |
| Portrait phone — count badge or card backs? | Remove count badge entirely; show name chip only              |
| Distribution formula                        | Edge-push: 15 %–85 % range                                    |
| Card back rendering                         | Reuse existing `CardBack` component in a sized wrapper `View` |

---

## 1 · Opponent Positioning

### Problem

`GameScreen.tsx` positions `OpponentZone` components with hardcoded pixel coordinates (e.g. `{ x: 100, y: 60 }`, `{ x: 260, y: 60 }`). On wide screens all opponents cluster in the top-left. Meanwhile `cardPositions.ts` already computes responsive positions using `width * (i + 1) / (n + 1)` for animation purposes — two separate systems that can drift.

### Solution: `edgeFraction` formula

Export a single `edgeFraction(i, n)` helper from `cardPositions.ts` that maps opponent index `i` (0-based) over the range 15 %–85 % of the canvas width:

```typescript
export function edgeFraction(i: number, n: number): number {
  const lo = 0.15,
    hi = 0.85;
  if (n <= 1) return 0.5;
  return lo + (i / (n - 1)) * (hi - lo);
}
```

Results:

| Player count | Opponents | x positions      |
| ------------ | --------- | ---------------- |
| 2            | 1         | 50 %             |
| 3            | 2         | 15 %, 85 %       |
| 4            | 3         | 15 %, 50 %, 85 % |

This same helper replaces the existing `(i + 1) / (n + 1)` formula in `cardPositions.ts` (animation origins) and the hardcoded positions in `GameScreen.tsx` (visual zone placement), so the two are always in sync.

### y coordinate

`cardPositions.ts` currently uses `height * 0.08` for the opponent hand y. `GameScreen.tsx` currently hardcodes `y: 60`. Both must be unified to `height * 0.08` so the visual zone and animation origin are at the same vertical position.

### `computeOpponentPositions` signature change

`GameScreen.tsx` has a `computeOpponentPositions(playerCount, myIndex)` helper that currently uses hardcoded x values. This function must accept `width` and `height` as additional parameters (and include them in the `useMemo` dependency array) so it can compute `edgeFraction(i, n) * width` and `height * 0.08`.

### Barrel export

`edgeFraction` must be added to `packages/game-canvas/index.ts` so `apps/client` can import it via `@dabb/game-canvas`.

### Files changed

- `packages/game-canvas/src/cards/cardPositions.ts` — replace `(i + 1) / (n + 1)` with `edgeFraction`; export `edgeFraction`
- `packages/game-canvas/index.ts` — add `edgeFraction` to exports
- `apps/client/src/ui/GameScreen.tsx` — update `computeOpponentPositions` to accept `width`/`height`, derive positions from `edgeFraction * width` and `height * 0.08`

---

## 2 · Card Back Rendering

### Problem

`OpponentZone.tsx` renders opponent card backs as plain `View` elements with `backgroundColor: '#2a6e3c'` (green). The actual card back texture — dark brown (`#5c2e0a`) with a white crosshatch overlay — already exists in `CardBack.tsx`, but is only used inside the main game table.

### `CardBack` component structure

`CardBack` is a self-contained component: it renders a `View` (with `position: 'absolute'`, `left: x`, `top: y`) containing a Skia `<Canvas>`. It already handles GPU compositing and caches its Skia picture via `PictureRecorder`.

### Solution: `CardBackView` wrapper

A new `CardBackView` component provides a flow-layout footprint for `CardBack` by wrapping it in a sized `View`. Using `x={0} y={0}` (the defaults) pins `CardBack` to the top-left of the wrapper:

```typescript
// packages/game-canvas/src/cards/CardBackView.tsx
export function CardBackView({ width, height }: { width: number; height: number }) {
  return (
    <View style={{ width, height }}>
      <CardBack width={width} height={height} />
    </View>
  );
}
```

This outer `View` participates in the flex layout (the card fan in `OpponentZone`), while `CardBack`'s internal `position: absolute` places it correctly within the wrapper. No changes to `CardBack.tsx`.

`CardBackView` must also be exported from `packages/game-canvas/index.ts`.

### Files changed

- `packages/game-canvas/src/cards/CardBackView.tsx` — **new file**
- `packages/game-canvas/index.ts` — add `CardBackView` export
- `apps/client/src/components/game/OpponentZone.tsx` — swap green `View` stubs for `CardBackView`

---

## 3 · Portrait Phone

On narrow portrait phones `OpponentZone` currently shows a card-count badge (number of cards in opponent's hand). This is removed — the count provides little useful information. Portrait mode shows **only the name chip** (opponent nickname). Landscape and tablet continue to show the card fan.

Per project convention (avoid layout shifts), set the count text's `opacity` to 0 rather than removing it from the tree if it is used as a layout spacer. If it is not layout-affecting, it can be removed entirely.

### Files changed

- `apps/client/src/components/game/OpponentZone.tsx` — remove `cardCountBadge` render path (or set `opacity: 0` if it affects layout height)

---

## 4 · Animations

Trick card-flight animations use `opponentHands[id].x` from `cardPositions.ts` as the origin point. Since `cardPositions.ts` is updated to use `edgeFraction`, animation origins automatically follow the new visual positions. No separate animation changes are needed.

---

## 5 · Testing

No current tests assert on opponent hand x/y positions. Add new unit tests in `packages/game-canvas/__tests__/cardPositions.test.ts` (alongside existing tests for `cardPositions.ts`) for the `edgeFraction` helper covering:

- `n=1` → 0.5
- `n=2, i=0` → 0.15 and `i=1` → 0.85
- `n=3` → 0.15, 0.5, 0.85

---

## Summary of File Changes

| File                                                   | Change                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`      | Replace even-split formula with `edgeFraction`; export helper  |
| `packages/game-canvas/src/cards/CardBackView.tsx`      | **New** — sized `View` wrapper around `CardBack`               |
| `packages/game-canvas/index.ts`                        | Export `edgeFraction` and `CardBackView`                       |
| `apps/client/src/components/game/OpponentZone.tsx`     | Use `CardBackView`, remove count badge                         |
| `apps/client/src/ui/GameScreen.tsx`                    | Accept `width`/`height` in position helper; use `edgeFraction` |
| `packages/game-canvas/__tests__/cardPositions.test.ts` | Add tests for `edgeFraction`                                   |
