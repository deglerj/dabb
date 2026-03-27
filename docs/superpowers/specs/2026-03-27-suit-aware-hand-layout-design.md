# Suit-Aware Hand Layout

**Date:** 2026-03-27
**Status:** Approved

## Problem

On narrow mobile screens (< 480 px wide) with 11+ cards, the player hand switches to two-row mode. The current layout has two problems:

1. **Wrong reading order** — the bottom row holds the first cards in sort order (kreuz, schippe…) and the top row holds the overflow. This is backwards: players expect to read top-to-bottom, left-to-right, like text.
2. **Suits split across rows** — the split happens at a fixed index (10), which often cuts through a suit group mid-hand.

## Goal

- Top row = first cards in sort order (read first).
- Bottom row = later cards (read second).
- The split falls on a suit boundary so no suit is split between rows, when screen space permits.

## Approach

Extend `CardPositionsInput` to carry suit information alongside card IDs, then compute the suit-boundary split inside `deriveCardPositions`.

## Design

### 1. API Change

`CardPositionsInput.handCardIds: string[]` → `handCards: { id: string; suit: string }[]`

All other fields in `CardPositionsInput` are unchanged. Callers update accordingly:

**`PlayerHand.tsx`** (already holds `Card[]` with `.suit`):

```ts
// before
handCardIds: displayedCards.map((c) => c.id);

// after
handCards: displayedCards.map((c) => ({ id: c.id, suit: c.suit }));
```

**Test helper `makeInput(n)`**: generate `handCards` with suits cycling through the four Binokel suits (kreuz → schippe → herz → bollen → kreuz…) so tests naturally exercise suit boundaries.

### 2. Split Algorithm

Runs inside `deriveCardPositions` when `isTwoRowMode` is active:

1. Walk `handCards` and collect **suit boundary indices** — positions `i` where `handCards[i].suit !== handCards[i-1].suit`.
2. Pick the boundary **closest to `n / 2`**. Ties favour the larger top row (prefer the boundary just above the midpoint).
3. If no boundaries exist (all cards same suit), fall back to `Math.ceil(n / 2)`.

```
splitIndex = suitBoundaryClosestToMidpoint(handCards)

topRow    = handCards[0 .. splitIndex - 1]   // first suits — rendered higher, read first
bottomRow = handCards[splitIndex ..]          // later suits — rendered lower, read second
```

**Scale**: driven by the larger of the two rows (more cards = tighter constraint), same principle as today.

**Z-index**: bottom row cards keep higher z-index than top row cards (bottom row is physically closer to the player and visually in front where rows overlap). Only which _cards_ live in which row changes.

**Rotation fan**: each row fans independently around its own midpoint — no change from current behaviour.

### 3. Examples

| Hand                          | Suit counts                              | Boundaries | Split | Top     | Bottom  |
| ----------------------------- | ---------------------------------------- | ---------- | ----- | ------- | ------- |
| 12 cards (3+3+3+3)            | kreuz(3), schippe(3), herz(3), bollen(3) | 3, 6, 9    | 6     | 6 cards | 6 cards |
| 16 cards after dabb (5+4+4+3) | kreuz(5), schippe(4), herz(4), bollen(3) | 5, 9, 13   | 9     | 9 cards | 7 cards |
| 12 cards, all kreuz           | kreuz(12)                                | —          | 6     | 6 cards | 6 cards |

### 4. Tests

Existing two-row tests in `cardPositions.test.ts` that assert on fixed index boundaries (e.g. "first 10 cards on bottom row") are rewritten to assert the new invariants.

New tests:

- **Suit stays together**: no two cards of the same suit appear on different rows (when the whole suit fits in one row).
- **Top row = first cards**: `card-0` (first suit) has a smaller Y than `card-{last}`.
- **Scale driven by larger row**: `cardScale` matches the scale needed to fit the larger row.
- **Graceful degradation**: all-same-suit hand splits at `ceil(n/2)`.

## Files Changed

| File                                                   | Change                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`      | Change input type; implement suit-boundary split; fix row assignment |
| `packages/game-canvas/__tests__/cardPositions.test.ts` | Update helper; rewrite stale tests; add new tests                    |
| `apps/client/src/components/game/PlayerHand.tsx`       | Update call site to pass `handCards` with suit                       |
