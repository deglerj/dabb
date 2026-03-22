# Duel-based Bidding — Design Spec

**Date:** 2026-03-22

## Problem

The current bidding system cycles all players in a round-robin (a → b → c → a → b → …). The correct Binokel bidding rule is a chain of one-on-one duels: the first two players duel, then the winner faces the next player, and so on.

## Desired Behavior

### Turn structure

- **2 players:** Duel(P1, P2) — single duel, bidding ends when one passes
- **3 players:** Duel(P1, P2) → Duel(winner, P3)
- **4 players:** Duel(P1, P2) → Duel(winner, P3) → Duel(winner, P4)

Where P1, P2, P3, … are the players in **bidding order** starting from `firstBidder` (the player after the dealer). The dealer rotates each round, so who opens the first duel rotates accordingly — this is already handled by the existing `firstBidder` logic.

### Within each duel

Turns strictly ping-pong between exactly two players until one passes:

- **First duel, first turn:** P1 opens (must bid ≥150 — cannot pass since `canPass` requires `currentBid > 0`). Then P2 responds, then P1, then P2, … until one passes.
- After the opening bid, either participant in Duel 1 can pass (since `currentBid > 0`).
- **Subsequent duels:** The new challenger goes first and must raise above the current bid, or pass immediately (`currentBid > 0` by this point so passing is allowed). Then the surviving winner responds, then the challenger, … until one passes.
- After a bid, the turn goes to the **other participant in the current duel** — not the next player in bidding order.
- When a player passes and more challengers remain, the next challenger becomes `currentBidder` and goes first in the new duel.
- When a player passes and no more challengers remain, bidding is complete.
- No "hold" mechanic — the new challenger must **raise**, not match.

## Implementation

### Approach: Compute duel from `passedPlayers.size` (minimal state change)

The duel phase is fully derivable from existing state — no new `GameState` fields needed.

**Bidding order** is constructed as:

```
biddingOrder[i] = (firstBidder + i) % playerCount   for i in 0..playerCount-1
```

The number of completed duels equals `passedPlayers.size`. The current duel always involves exactly two players:

1. **The challenger:** `biddingOrder[passedPlayers.size + 1]`
2. **The survivor:** found by iterating `biddingOrder[0]` through `biddingOrder[passedPlayers.size]` (inclusive), checking `passedPlayers.has(biddingOrder[i])` for each, and returning the first entry not present. This works because, by the duel structure invariant, every player who has passed was a challenger in a completed duel, and all challengers appear in `biddingOrder` before the current challenger — so exactly one entry in `biddingOrder[0..passedPlayers.size]` will be absent from `passedPlayers`.

### `getNextBidder` — new signature

```typescript
getNextBidder(
  player: PlayerIndex,       // the player who just bid or just passed
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>,  // already updated if this is a pass event; unmodified for a bid event
  firstBidder: PlayerIndex,  // non-null; caller asserts before calling (see phase invariant below)
): PlayerIndex | null
```

The old first parameter was named `currentBidder` and represented the player whose turn was next. The new parameter `player` represents the player who **just acted** (bid or passed) — it is always `event.payload.playerIndex` at both callsites.

**After a bid (`handleBidPlaced` callsite):** `passedPlayers` is unmodified (a bid event does not add a passer). Determine the current duel participants using the algorithm above. If `player === challenger`, return `survivor`; otherwise return `challenger`.

**After a pass (`handlePlayerPassed` callsite):** `passedPlayers` already includes the passer. Let `N = passedPlayers.size`. If `N + 1 < playerCount` (another challenger exists at `biddingOrder[N + 1]`), return that challenger. Otherwise return `null` (bidding complete).

The existing `isBiddingComplete` guard in `handlePlayerPassed` (which sets `nextBidder = null` directly when bidding is complete) is kept as a defensive check — `getNextBidder` also returns `null` in this case, so either path produces the same result.

### Phase invariant: `firstBidder` is always non-null during bidding

`firstBidder` is set in `handleCardsDealt` and is non-null for the entire bidding phase. Both callsites in `reducer.ts` should assert non-null before passing it to `getNextBidder`:

```typescript
if (state.firstBidder === null) throw new Error('firstBidder is null during bidding');
getNextBidder(event.payload.playerIndex, state.playerCount, passedPlayers, state.firstBidder);
```

### `isBiddingComplete` — unchanged

Checks `activePlayers <= 1` (`passedPlayers.size >= playerCount - 1`). Holds under duel semantics: there is always exactly one survivor at the end of bidding. No change needed.

### `getBiddingWinner` — unchanged

Iterates raw player indices `0..playerCount-1` and returns the first not in `passedPlayers`. Correct because there is always exactly one survivor — tie-breaking by raw index is irrelevant. No change needed.

### `canPass` — unchanged

`canPass(currentBid)` returns `true` only when `currentBid > 0`. Correctly prevents P1 from passing before any bid, and allows the new challenger to pass immediately in later duels.

### Callers of `getNextBidder`

`getNextBidder` is called only in `packages/game-logic/src/state/reducer.ts` (two callsites: `handleBidPlaced` and `handlePlayerPassed`). It is exported from the package but not called in `apps/`. The test file (`bidding.test.ts`) also calls it directly and must be updated for the new signature.

### Files changed

| File                                                         | Change                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/game-logic/src/phases/bidding.ts`                  | Update `getNextBidder` signature (rename first param to `player`, add `firstBidder: PlayerIndex`); implement duel logic for both bid and pass cases                               |
| `packages/game-logic/src/state/reducer.ts`                   | Update both `handleBidPlaced` and `handlePlayerPassed` callsites: assert `state.firstBidder !== null`, pass it as the new parameter, pass `event.payload.playerIndex` as `player` |
| `packages/game-logic/src/__tests__/bidding.test.ts`          | Update existing `getNextBidder` tests for new signature; add unit tests for duel transitions (3p and 4p), including bid-after-bid and pass-to-next-challenger cases               |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Add integration test scenarios for duel bidding                                                                                                                                   |

### State schema

No changes to `GameState`. `firstBidder` is already stored and available.

## Out of scope

- Hold ("Weiter"/"Ja") mechanic — not part of this change
- UI changes to show duel state visually — may be a follow-up
