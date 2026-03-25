# Duel-based Bidding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the round-robin bidding turn order with a chain of one-on-one duels (P1 vs P2, winner vs P3, winner vs P4).

**Architecture:** Update `getNextBidder` in `bidding.ts` with a new signature that accepts `firstBidder`, then derives the current duel participants from `passedPlayers.size` and the bidding order. No state schema changes. Two callsites in `reducer.ts` need updating.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@dabb/game-logic`, `@dabb/shared-types`)

**Spec:** `docs/superpowers/specs/2026-03-22-duel-bidding-design.md`

---

## File Map

| File                                                         | Change                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `packages/game-logic/src/phases/bidding.ts`                  | Replace `getNextBidder` body; update signature                 |
| `packages/game-logic/src/state/reducer.ts`                   | Update two callsites (`handleBidPlaced`, `handlePlayerPassed`) |
| `packages/game-logic/src/__tests__/bidding.test.ts`          | Update existing tests; add duel transition tests               |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Add 3-player duel bidding integration test                     |

---

## Task 1: Update `getNextBidder` unit tests for new signature and duel logic

**Files:**

- Modify: `packages/game-logic/src/__tests__/bidding.test.ts`

Background: `getNextBidder` currently takes `(currentBidder, playerCount, passedPlayers)`. The new signature is `(player, playerCount, passedPlayers, firstBidder)` where `player` is the player who just acted. Within a duel, turns ping-pong between two participants. When a player passes, `getNextBidder` returns the next challenger (or `null` if none remain).

Example with 3 players, `firstBidder=1` (dealer=0): `biddingOrder = [1, 2, 0]`

- Duel 1 participants: P1 (survivor) vs P2 (challenger)
- After P1 bids (passedPlayers empty): return P2
- After P2 bids (passedPlayers empty): return P1
- After P2 passes (passedPlayers={2}): return P0 (next challenger = biddingOrder[1+1])
- After P0 bids (passedPlayers={2}): duel 2 participants: P0 (challenger) vs P1 (survivor); return P1
- After P0 passes (passedPlayers={2,0}): N+1=3, not < 3 → return null (P1 wins)

Example with 4 players, `firstBidder=1` (dealer=0): `biddingOrder = [1, 2, 3, 0]`

- Duel 1: P1 vs P2. Duel 2: winner vs P3. Duel 3: winner vs P0.
- After P2 passes (passedPlayers={2}): N=1, N+1=2 < 4 → return P3
- After P3 passes (passedPlayers={2,3}): N=2, N+1=3 < 4 → return P0
- After P0 passes (passedPlayers={2,3,0}): N=3, N+1=4, not < 4 → return null

- [ ] **Step 1: Replace the existing `getNextBidder` describe block in `bidding.test.ts`**

Find and replace the entire `describe('getNextBidder', ...)` block (lines 22–38) with:

```typescript
describe('getNextBidder', () => {
  // 3-player, dealer=0, firstBidder=1, biddingOrder=[1,2,0]
  describe('3-player duel chain (firstBidder=1)', () => {
    const playerCount = 3 as const;
    const firstBidder = 1 as const;

    it('after P1 bids (Duel 1): returns challenger P2', () => {
      const passed = new Set<0 | 1 | 2>();
      expect(getNextBidder(1, playerCount, passed, firstBidder)).toBe(2);
    });

    it('after P2 bids (Duel 1): returns survivor P1', () => {
      const passed = new Set<0 | 1 | 2>();
      expect(getNextBidder(2, playerCount, passed, firstBidder)).toBe(1);
    });

    it('after P2 passes (Duel 1 → Duel 2): returns next challenger P0', () => {
      const passed = new Set<0 | 1 | 2>([2]);
      expect(getNextBidder(2, playerCount, passed, firstBidder)).toBe(0);
    });

    it('after P0 bids (Duel 2): returns survivor P1', () => {
      const passed = new Set<0 | 1 | 2>([2]);
      expect(getNextBidder(0, playerCount, passed, firstBidder)).toBe(1);
    });

    it('after P1 bids (Duel 2): returns challenger P0', () => {
      const passed = new Set<0 | 1 | 2>([2]);
      expect(getNextBidder(1, playerCount, passed, firstBidder)).toBe(0);
    });

    it('after P0 passes (Duel 2 → bidding ends): returns null', () => {
      const passed = new Set<0 | 1 | 2>([2, 0]);
      expect(getNextBidder(0, playerCount, passed, firstBidder)).toBe(null);
    });
  });

  // 4-player, dealer=0, firstBidder=1, biddingOrder=[1,2,3,0]
  describe('4-player duel chain (firstBidder=1)', () => {
    const playerCount = 4 as const;
    const firstBidder = 1 as const;

    it('after P1 bids (Duel 1): returns challenger P2', () => {
      const passed = new Set<0 | 1 | 2 | 3>();
      expect(getNextBidder(1, playerCount, passed, firstBidder)).toBe(2);
    });

    it('after P2 passes (Duel 1 → Duel 2): returns next challenger P3', () => {
      const passed = new Set<0 | 1 | 2 | 3>([2]);
      expect(getNextBidder(2, playerCount, passed, firstBidder)).toBe(3);
    });

    it('after P3 passes (Duel 2 → Duel 3): returns next challenger P0', () => {
      const passed = new Set<0 | 1 | 2 | 3>([2, 3]);
      expect(getNextBidder(3, playerCount, passed, firstBidder)).toBe(0);
    });

    it('after P0 passes (Duel 3 → bidding ends): returns null', () => {
      const passed = new Set<0 | 1 | 2 | 3>([2, 3, 0]);
      expect(getNextBidder(0, playerCount, passed, firstBidder)).toBe(null);
    });

    it('after P3 bids (Duel 2): returns survivor P1', () => {
      const passed = new Set<0 | 1 | 2 | 3>([2]);
      expect(getNextBidder(3, playerCount, passed, firstBidder)).toBe(1);
    });
  });

  // 2-player: single duel
  describe('2-player (firstBidder=1)', () => {
    const playerCount = 2 as const;
    const firstBidder = 1 as const;

    it('after P1 bids: returns challenger P0', () => {
      const passed = new Set<0 | 1>();
      expect(getNextBidder(1, playerCount, passed, firstBidder)).toBe(0);
    });

    it('after P0 passes (bidding ends): returns null', () => {
      const passed = new Set<0 | 1>([0]);
      expect(getNextBidder(0, playerCount, passed, firstBidder)).toBe(null);
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @dabb/game-logic test -- --reporter=verbose bidding
```

Expected: FAIL — the existing `getNextBidder` doesn't accept a `firstBidder` argument.

---

## Task 2: Implement the new `getNextBidder` in `bidding.ts`

**Files:**

- Modify: `packages/game-logic/src/phases/bidding.ts`

The algorithm:

1. Build `biddingOrder[i] = (firstBidder + i) % playerCount` for i in 0..playerCount-1
2. The current challenger is `biddingOrder[passedPlayers.size + 1]`
3. The current survivor is the first entry in `biddingOrder[0..passedPlayers.size]` not in `passedPlayers`
4. **After a bid:** if `player === challenger` return `survivor`, else return `challenger`
5. **After a pass:** `passedPlayers` already includes the passer, so `N = passedPlayers.size`; if `N + 1 < playerCount` return `biddingOrder[N + 1]`, else return `null`

How to tell whether this is a bid or pass call: for a pass, `passedPlayers.has(player)` is `true` (passer was just added before calling). For a bid, `passedPlayers.has(player)` is `false`.

- [ ] **Step 1: Replace the `getNextBidder` function body**

Replace the entire `getNextBidder` function (lines 10–23 in `bidding.ts`) with:

```typescript
/**
 * Get the next player in the duel-based bidding order.
 *
 * @param player - The player who just bid or passed (event.payload.playerIndex)
 * @param playerCount - Total number of players
 * @param passedPlayers - Set of players who have passed (already includes passer for pass events)
 * @param firstBidder - The first player in bidding order (player after dealer); never null during bidding
 */
export function getNextBidder(
  player: PlayerIndex,
  playerCount: PlayerCount,
  passedPlayers: Set<PlayerIndex>,
  firstBidder: PlayerIndex
): PlayerIndex | null {
  // Build bidding order starting from firstBidder
  const biddingOrder = Array.from(
    { length: playerCount },
    (_, i) => ((firstBidder + i) % playerCount) as PlayerIndex
  );

  const justPassed = passedPlayers.has(player);

  if (justPassed) {
    // After a pass: transition to next challenger, or end bidding
    const n = passedPlayers.size;
    if (n + 1 < playerCount) {
      return biddingOrder[n + 1];
    }
    return null;
  } else {
    // After a bid: return the other participant in the current duel
    const challengerIndex = passedPlayers.size + 1;
    const challenger = biddingOrder[challengerIndex];

    // Survivor: first entry in biddingOrder[0..passedPlayers.size] not in passedPlayers
    let survivor: PlayerIndex | undefined;
    for (let i = 0; i <= passedPlayers.size; i++) {
      if (!passedPlayers.has(biddingOrder[i])) {
        survivor = biddingOrder[i];
        break;
      }
    }

    if (survivor === undefined) {
      return null; // should not happen in a well-formed game
    }

    return player === challenger ? survivor : challenger;
  }
}
```

- [ ] **Step 2: Run the tests and confirm they pass**

```bash
pnpm --filter @dabb/game-logic test -- --reporter=verbose bidding
```

Expected: all `getNextBidder` tests PASS. Other tests in the file should still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/game-logic/src/phases/bidding.ts packages/game-logic/src/__tests__/bidding.test.ts
git commit -m "feat(game-logic): implement duel-based bidding in getNextBidder"
```

---

## Task 3: Update the two `getNextBidder` callsites in `reducer.ts`

**Files:**

- Modify: `packages/game-logic/src/state/reducer.ts:184-188,206-208`

Both callsites must:

1. Assert `state.firstBidder !== null` (it is always set by `handleCardsDealt` before any bid/pass)
2. Pass `state.firstBidder` as the new fourth argument

- [ ] **Step 1: Update `handleBidPlaced` (around line 184)**

Find:

```typescript
const nextBidder = getNextBidder(event.payload.playerIndex, state.playerCount, state.passedPlayers);
```

Replace with:

```typescript
if (state.firstBidder === null) throw new Error('firstBidder is null during bidding');
const nextBidder = getNextBidder(
  event.payload.playerIndex,
  state.playerCount,
  state.passedPlayers,
  state.firstBidder
);
```

- [ ] **Step 2: Update `handlePlayerPassed` (around line 206–208)**

Find:

```typescript
const nextBidder = biddingComplete
  ? null
  : getNextBidder(event.payload.playerIndex, state.playerCount, newPassedPlayers);
```

Replace with:

```typescript
if (state.firstBidder === null) throw new Error('firstBidder is null during bidding');
const nextBidder = biddingComplete
  ? null
  : getNextBidder(
      event.payload.playerIndex,
      state.playerCount,
      newPassedPlayers,
      state.firstBidder
    );
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm --filter @dabb/game-logic test
```

Expected: all tests PASS (the existing integration tests use 2-player which is supported by the new logic).

- [ ] **Step 4: Commit**

```bash
git add packages/game-logic/src/state/reducer.ts
git commit -m "feat(game-logic): update reducer to use duel-based getNextBidder"
```

---

## Task 4: Extend `GameTestHelper` with `charlie` and add 3-player integration tests

**Files:**

- Modify: `packages/game-logic/src/__tests__/testHelpers.ts`
- Modify: `packages/game-logic/src/__tests__/roundIntegration.test.ts`

`GameTestHelper` currently only exposes `alice` (index 0) and `bob` (index 1). We need `charlie` (index 2) for 3-player tests. The `dealCards` method already maps player 2 to an empty array by default, so for bidding-only tests we can pass `{ alice: [], bob: [], dabb: [] }` — charlie gets an empty hand from the existing code.

- [ ] **Step 1: Add `charlie` to `GameTestHelper` in `testHelpers.ts`**

In the class body, after `public bob: PlayerActions;` (line 74), add:

```typescript
  public charlie: PlayerActions;
```

In the constructor body, after `this.bob = this.createPlayerActions(1 as PlayerIndex, 'Bob');` (line 82), add:

```typescript
this.charlie = this.createPlayerActions(2 as PlayerIndex, 'Charlie');
```

- [ ] **Step 2: Add the integration tests at the end of `roundIntegration.test.ts`**

```typescript
describe('Three-Player Bidding Duel Chain', () => {
  it('runs duels in order: bob vs charlie, then winner vs alice (dealer)', () => {
    const game = GameTestHelper.create('test-duel');
    game.alice.joins();
    game.bob.joins();
    game.charlie.joins();

    // dealer=0 (alice), firstBidder=1 (bob), biddingOrder=[bob(1), charlie(2), alice(0)]
    game.startGame({ playerCount: 3, targetScore: 1000, dealer: 0 as PlayerIndex });
    // Empty hands suffice — we are only testing bidding turn order
    game.dealCards({ alice: [], bob: [], dabb: [] });

    // Duel 1: bob (firstBidder) vs charlie
    expect(game.state.currentBidder).toBe(1); // bob opens
    game.bob.bids(150);
    expect(game.state.currentBidder).toBe(2); // charlie responds

    game.charlie.bids(160);
    expect(game.state.currentBidder).toBe(1); // back to bob

    game.bob.passes();
    // Duel 1 over: charlie won. Duel 2: charlie vs alice (last challenger)
    expect(game.state.currentBidder).toBe(0); // alice is next challenger

    game.alice.bids(170);
    expect(game.state.currentBidder).toBe(2); // charlie responds

    game.charlie.passes();
    // Bidding complete: alice wins
    expect(game.state.phase).toBe('dabb');
    expect(game.state.bidWinner).toBe(0); // alice
    expect(game.state.currentBid).toBe(170);
  });

  it('ends bidding immediately when new challenger passes without raising', () => {
    const game = GameTestHelper.create('test-duel-instant-pass');
    game.alice.joins();
    game.bob.joins();
    game.charlie.joins();

    game.startGame({ playerCount: 3, targetScore: 1000, dealer: 0 as PlayerIndex });
    game.dealCards({ alice: [], bob: [], dabb: [] });

    // Duel 1: bob vs charlie
    game.bob.bids(150);
    game.charlie.passes(); // charlie passes immediately

    // Duel 2: bob vs alice — alice goes first as challenger
    expect(game.state.currentBidder).toBe(0); // alice is challenger
    game.alice.passes(); // alice passes immediately

    // Bidding complete: bob wins with 150
    expect(game.state.phase).toBe('dabb');
    expect(game.state.bidWinner).toBe(1); // bob
    expect(game.state.currentBid).toBe(150);
  });
});
```

- [ ] **Step 3: Run the new tests**

```bash
pnpm --filter @dabb/game-logic test -- --reporter=verbose roundIntegration
```

Expected: both new `Three-Player Bidding Duel Chain` tests PASS.

- [ ] **Step 4: Run the full test suite**

```bash
pnpm --filter @dabb/game-logic test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/game-logic/src/__tests__/roundIntegration.test.ts packages/game-logic/src/__tests__/testHelpers.ts
git commit -m "test(game-logic): add 3-player duel bidding integration tests"
```

---

## Task 5: CI check

- [ ] **Run the full CI suite**

```bash
# From repo root
pnpm run build && pnpm lint && pnpm test
```

Expected: build succeeds (type-check passes), lint clean, all tests pass.

If any failures occur, fix them before proceeding.

- [ ] **Commit any fixes, then verify CI passes locally**
