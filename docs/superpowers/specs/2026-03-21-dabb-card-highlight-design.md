# Dabb Card Highlight Design

**Date:** 2026-03-21
**Status:** Approved

## Problem

After the bid winner takes the dabb, they cannot easily tell which cards in their hand came from the dabb versus their original hand. This information is most valuable during the discard step (choosing which cards to return) and remains useful through trump selection and melding.

## Solution

Highlight dabb-origin cards with a golden border overlay on the card, visible from after dabb pickup through the end of the melding phase. The highlight turns off when the tricks phase begins.

## Architecture

No state changes are needed. `GameState.dabbCardIds` already tracks dabb-origin card IDs and persists across the `dabb → trump → melding` phases.

### Component Changes

**`CardView` (`packages/game-canvas/src/cards/CardView.tsx`)**

Add a `highlighted?: boolean` prop (default `false`). When true, render an absolute-positioned border View on top of the card:

- `borderColor: '#ffd700'` (bright gold — distinct from `selected`'s `#f39c12` orange)
- `borderWidth: 2` (thinner than `selected`'s 3px to differentiate)
- `borderRadius: width * 0.06` (matches card corner radius)
- `pointerEvents="none"` (non-interactive)

`highlighted` and `selected` can coexist. A dabb card selected for discard will show both borders simultaneously — this is intentional: the player sees both "this came from the dabb" and "I've marked it for discard" at the same time.

**`PlayerHand` (`apps/client/src/components/game/PlayerHand.tsx`)**

Compute highlighted IDs before rendering:

```ts
const highlightedIds =
  gameState.phase !== 'tricks' && gameState.dabbCardIds.length > 0
    ? new Set(gameState.dabbCardIds)
    : new Set<string>();
```

Pass `highlighted={highlightedIds.has(card.id)}` to `CardView` in both rendering branches:

- The discard-mode branch (new, added alongside `selected`)
- The normal-play branch

### Highlight Lifecycle

| Phase                 | Highlight active? | Notes                               |
| --------------------- | ----------------- | ----------------------------------- |
| `dabb` (take step)    | No                | Dabb cards not yet in hand          |
| `dabb` (discard step) | Yes               | Most useful — choose what to return |
| `trump`               | Yes               | Declare trump with full context     |
| `melding`             | Yes               | Declare melds with full context     |
| `tricks`              | No                | Turns off when trick-taking starts  |

The condition `phase !== 'tricks'` handles all cases automatically since `dabbCardIds` is already empty in pre-dabb phases.

## Files Changed

| File                                             | Change                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `packages/game-canvas/src/cards/CardView.tsx`    | Add `highlighted` prop + border overlay                    |
| `apps/client/src/components/game/PlayerHand.tsx` | Compute `highlightedIds`, pass to both `CardView` branches |

## Testing

- Manual: take dabb as bid winner → confirm gold border appears on dabb cards → discard and proceed → confirm gold border is gone when tricks phase starts
- The feature is visual-only with no logic changes, so no unit tests are needed
