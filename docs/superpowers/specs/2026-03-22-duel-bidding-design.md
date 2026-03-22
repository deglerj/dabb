# Duel-based Bidding — Design Spec

**Date:** 2026-03-22

## Problem

The current bidding system cycles all players in a round-robin (a → b → c → a → b → …). The correct Binokel bidding rule is a chain of one-on-one duels: the first two players duel, then the winner faces the next player, and so on.

## Desired Behavior

### Turn structure

- **3 players:** Duel(P1, P2) → Duel(winner, P3)
- **4 players:** Duel(P1, P2) → Duel(winner, P3) → Duel(winner, P4)

Where P1, P2, P3, … are the players in **bidding order** starting from `firstBidder` (the player after the dealer). The dealer rotates each round, so who opens the first duel rotates accordingly — this is already handled by the existing `firstBidder` logic.

### Within each duel

- Players alternate turns: one raises or passes.
- **First duel, first turn:** P1 must open with a bid of at least 150 (cannot pass — same as current rule, since `canPass` requires `currentBid > 0`).
- **Subsequent duels:** The new challenger goes first and must raise above the current bid, or pass immediately (passing is allowed since `currentBid > 0` by the time a new duel starts).
- When a player passes, if more challengers remain, the next challenger becomes `currentBidder` and goes first in the new duel.
- When a player passes and no more challengers remain, bidding is complete.
- No "hold" mechanic — the new challenger must **raise**, not match.

## Implementation

### Approach: Compute duel from `passedPlayers.size` (minimal state change)

The duel phase is fully derivable from existing state — no new `GameState` fields needed.

**Bidding order** is constructed as:

```
[(firstBidder + i) % playerCount  for i in 0..playerCount-1]
```

The number of completed duels equals `passedPlayers.size`. The current duel involves:

- The surviving player (the one not in `passedPlayers`)
- `bidding_order[passedPlayers.size + 1]` — the next challenger

When a player passes, `getNextBidder` checks if another challenger exists. If yes, returns that challenger as the next `currentBidder`. If no, returns `null` (bidding complete).

### Files changed

| File                                                         | Change                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `packages/game-logic/src/phases/bidding.ts`                  | Update `getNextBidder` signature to accept `firstBidder`; implement duel logic |
| `packages/game-logic/src/state/reducer.ts`                   | Pass `state.firstBidder` to `getNextBidder` at each callsite                   |
| `packages/game-logic/src/__tests__/bidding.test.ts`          | Add unit tests for duel transitions (3p and 4p)                                |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Add integration test scenarios for duel bidding                                |

### State schema

No changes to `GameState`. `firstBidder` is already stored and available.

### `canPass` rule

Unchanged: `canPass(currentBid)` returns `true` only when `currentBid > 0`. This correctly prevents the opening bidder from passing in Duel 1, and correctly allows the new challenger to pass immediately in later duels.

## Out of scope

- Hold ("Weiter"/"Ja") mechanic — not part of this change
- UI changes to show duel state visually — may be a follow-up
