# Off-Felt Drop Detection — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Implement the missing "off-felt" drop boundary check for card drag-to-play

---

## Background

The game UI rewrite spec (2026-03-12) states:

> Drop anywhere over the felt — the game determines the correct trick slot and snaps the card there via arc animation. If the drop is invalid (wrong phase, invalid card, **off-felt**), the card springs back to its hand position via spring animation.

Currently `PlayerHand.handleDrop` receives `(x, y)` drop coordinates but ignores them entirely. Any drop of a game-valid card is accepted regardless of where on screen it lands. This implements the missing felt boundary check.

---

## Design

### Shared surround constant

Add a named constant in `packages/game-canvas/src/table/feltBounds.ts` and use it in both `GameTable.tsx` and `getFeltBounds`. This ensures the two never silently diverge if the default changes:

```ts
export const DEFAULT_SURROUND_FRACTION = 0.05;
```

`GameTable.tsx` is updated to import and use this constant instead of its inline `0.05` default parameter value. Concretely, `surroundFraction = 0.05` in the function signature becomes `surroundFraction = DEFAULT_SURROUND_FRACTION`. The body does not contain a literal — it already uses the `surroundFraction` variable.

### New utility: `getFeltBounds`

Add `packages/game-canvas/src/table/feltBounds.ts`:

```ts
export const DEFAULT_SURROUND_FRACTION = 0.05;

export interface FeltBounds {
  x: number; // left edge of felt (px)
  y: number; // top edge of felt (px)
  width: number; // felt width (px)
  height: number; // felt height (px)
}

export function getFeltBounds(
  screenWidth: number,
  screenHeight: number,
  surroundFraction = DEFAULT_SURROUND_FRACTION
): FeltBounds {
  const surround = Math.round(screenWidth * surroundFraction);
  return {
    x: surround,
    y: surround,
    width: screenWidth - surround * 2,
    height: screenHeight - surround * 2,
  };
}
```

Export `getFeltBounds`, `FeltBounds`, and `DEFAULT_SURROUND_FRACTION` from `packages/game-canvas/index.ts`.

### Updated `handleDrop` in `PlayerHand`

`getFeltBounds` is a plain function (not a hook), called after `useWindowDimensions()` and before the `if (!gameState) return null` early return:

```ts
const { width, height } = useWindowDimensions();
const feltBounds = getFeltBounds(width, height);

if (!gameState) return null;

// ...

// Note: the existing signature uses `_x`/`_y`; these must be renamed to `x`/`y`.
const handleDrop = (cardId: string) => (x: number, y: number) => {
  const onFelt =
    x >= feltBounds.x &&
    x <= feltBounds.x + feltBounds.width &&
    y >= feltBounds.y &&
    y <= feltBounds.y + feltBounds.height;
  if (onFelt && validIds.has(cardId)) {
    onPlayCard(cardId);
  }
};
```

Off-felt drops use the same behaviour as invalid-card drops: the card springs back to its hand position. No special animation or sound is needed. The spring-back is already unconditionally applied in `dragGesture.ts` on every pan release.

`useWindowDimensions` re-renders the component on orientation change or window resize, so `getFeltBounds` is automatically recomputed whenever the screen dimensions change.

---

## Files Changed

| File                                             | Change                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `packages/game-canvas/src/table/feltBounds.ts`   | New file — `DEFAULT_SURROUND_FRACTION`, `getFeltBounds`             |
| `packages/game-canvas/src/table/GameTable.tsx`   | Import and use `DEFAULT_SURROUND_FRACTION` instead of inline `0.05` |
| `packages/game-canvas/index.ts`                  | Export `getFeltBounds`, `FeltBounds`, `DEFAULT_SURROUND_FRACTION`   |
| `apps/client/src/components/game/PlayerHand.tsx` | Use `getFeltBounds` in `handleDrop`                                 |

---

## Testing

**`packages/game-canvas/src/table/__tests__/feltBounds.test.ts`** (new — `__tests__/` directory does not yet exist and must be created; Vitest auto-discovers `**/*.test.ts` so no config change is needed):

- Returns correct bounds for a standard screen size with the default `surroundFraction`
- Returns correct bounds with a custom `surroundFraction`
- On a non-square (portrait) screen (e.g. `screenWidth=390, screenHeight=844`), the surround is derived from `screenWidth` only (`Math.round(390 * 0.05) = 20`), so `y = 20`, not `Math.round(844 * 0.05) = 42`. This test pins the intentional asymmetry and guards against a future "fix" that switches the vertical axis to use `screenHeight`.

**`PlayerHand`** has no existing tests. No new `PlayerHand` tests are required by this change — the felt check is a pure condition on an otherwise-untested component. Any future `PlayerHand` tests that exercise the drop path must pass coordinates that fall within the felt bounds (i.e. within `[surround, width-surround] × [surround, height-surround]`) to simulate a valid drop.
