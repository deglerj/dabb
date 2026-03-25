# Dabb Card Highlight Design

**Date:** 2026-03-21
**Status:** Approved

## Problem

After the bid winner takes the dabb, they cannot easily tell which cards in their hand came from the dabb versus their original hand. This information is most valuable during the discard step (choosing which cards to return) and remains useful through trump selection and melding.

## Solution

Highlight dabb-origin cards with a golden border overlay on the card, visible from after dabb pickup through the end of the melding phase. The highlight turns off when the tricks phase begins.

## Architecture

No state changes are needed. `GameState.dabbCardIds` already tracks dabb-origin card IDs and persists across the `dabb → trump → melding` phases (it is cleared at round end by the reducer).

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
const showDabbHighlight =
  (gameState.phase === 'dabb' || gameState.phase === 'trump' || gameState.phase === 'melding') &&
  gameState.dabbCardIds.length > 0;
const highlightedIds = showDabbHighlight ? new Set(gameState.dabbCardIds) : new Set<string>();
```

Pass `highlighted={highlightedIds.has(card.id)}` to `CardView` in both rendering branches:

- The discard-mode branch (new, added alongside `selected`)
- The normal-play branch

### Highlight Lifecycle

Both the "take step" and "discard step" of the dabb phase share the same `phase === 'dabb'` value. The distinction between them is made by `dabbCardIds.length > 0`: the `DABB_TAKEN` event populates `dabbCardIds` and simultaneously empties `state.dabb`, so `dabbCardIds` is empty during the take step and non-empty during the discard step.

| Phase                              | Highlight active? | Why                                                                                |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `waiting`, `bidding`               | No                | `dabbCardIds` is empty (pre-dabb)                                                  |
| `dabb` (take step)                 | No                | `phase === 'dabb'` but `dabbCardIds.length === 0` — `DABB_TAKEN` has not fired yet |
| `dabb` (discard step)              | Yes               | `phase === 'dabb'` and `dabbCardIds.length > 0` — both conditions met              |
| `trump`                            | Yes               | Whitelist includes `trump`                                                         |
| `melding`                          | Yes               | Whitelist includes `melding`                                                       |
| `tricks`, `finished`, `terminated` | No                | Phase whitelist excludes these                                                     |

The phase whitelist (`dabb || trump || melding`) is used rather than a blacklist because `dabbCardIds` is not cleared until round end, so it may still be non-empty during `tricks`, `finished`, and `terminated` — the whitelist prevents highlights there.

**Going Out edge case:** If the bid winner goes out (`GoingOutEvent`), the round ends immediately during the `dabb` phase and the phase transitions directly to `finished` (bypassing `trump` and `melding`). The highlight is visible while the player is deciding whether to go out — correct and desirable. Once the phase becomes `finished`, it is excluded by the whitelist.

**Anti-cheat:** `dabbCardIds` is server-side filtered — non-bid-winners receive an empty array. The `dabbCardIds.length > 0` guard in `showDabbHighlight` means non-bid-winners never see any highlight, which is the correct behaviour. No additional client-side guard is needed.

## Files Changed

| File                                             | Change                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `packages/game-canvas/src/cards/CardView.tsx`    | Add `highlighted` prop + border overlay                                        |
| `apps/client/src/components/game/PlayerHand.tsx` | Compute `highlightedIds` via phase whitelist, pass to both `CardView` branches |

## Testing

**Unit test** for `showDabbHighlight` derivation in `PlayerHand` (or extracted helper), covering:

- `phase === 'dabb'` with non-empty `dabbCardIds` → highlight on
- `phase === 'trump'` with non-empty `dabbCardIds` → highlight on
- `phase === 'melding'` with non-empty `dabbCardIds` → highlight on
- `phase === 'dabb'` with empty `dabbCardIds` (take step) → highlight off
- `phase === 'tricks'` with non-empty `dabbCardIds` → highlight off

**Manual verification:** take dabb as bid winner → confirm gold border on dabb cards → proceed through trump/melding → confirm gold border disappears when tricks phase starts.
