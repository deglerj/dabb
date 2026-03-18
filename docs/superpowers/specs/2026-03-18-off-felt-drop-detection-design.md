# Off-Felt Drop Detection — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Implement the missing "off-felt" drop boundary check for card drag-to-play

---

## Background

The game UI rewrite spec (2026-03-12) states:

> Drop anywhere over the felt — the game determines the correct trick slot and snaps the card there via arc animation. If the drop is invalid (wrong phase, invalid card, **off-felt**), the card springs back to its hand position via spring animation.

Currently `PlayerHand.handleDrop` receives `(x, y)` drop coordinates but ignores them entirely. Any drop of a game-valid card is accepted regardless of where on screen it lands. This implements the missing felt boundary check.

---

## Design

### New utility: `getFeltBounds`

Add `packages/game-canvas/src/table/feltBounds.ts`:

```ts
export interface FeltBounds {
  x: number; // left edge of felt (px)
  y: number; // top edge of felt (px)
  width: number; // felt width (px)
  height: number; // felt height (px)
}

export function getFeltBounds(
  screenWidth: number,
  screenHeight: number,
  surroundFraction = 0.05
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

The formula mirrors `GameTable.tsx` exactly (`surround = Math.round(width * surroundFraction)`), keeping felt geometry in one package. Export from `packages/game-canvas/index.ts`.

### Updated `handleDrop` in `PlayerHand`

```ts
const feltBounds = getFeltBounds(width, height);

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

---

## Files Changed

| File                                             | Change                                  |
| ------------------------------------------------ | --------------------------------------- |
| `packages/game-canvas/src/table/feltBounds.ts`   | New file — `getFeltBounds` utility      |
| `packages/game-canvas/index.ts`                  | Export `getFeltBounds` and `FeltBounds` |
| `apps/client/src/components/game/PlayerHand.tsx` | Use `getFeltBounds` in `handleDrop`     |

---

## Testing

Add a unit test in `packages/game-canvas/src/table/__tests__/feltBounds.test.ts`:

- `getFeltBounds` returns correct bounds for a standard screen size with the default `surroundFraction`
- `getFeltBounds` returns correct bounds with a custom `surroundFraction`

No changes needed to `PlayerHand` tests — the valid/invalid card paths already cover the drop logic, and the felt check is an additive condition on the same code path.
