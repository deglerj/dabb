# Suit-Aware Hand Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two-row mobile hand layout so cards read top-to-bottom like text, with suits kept together in the same row.

**Architecture:** All layout logic lives in `cardPositions.ts`. The input type is extended to carry suit per card so the function can find suit boundaries. The two-row split is moved from a fixed index (10) to the suit boundary closest to the midpoint. Reading order is flipped: top row = first cards in sort order, bottom row = later cards.

**Tech Stack:** TypeScript, Vitest

---

## File Map

| File                                                      | Change                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`         | Rename `handCardIds` → `handCards`; add `findSuitBoundarySplit`; fix row assignment and scale |
| `packages/game-canvas/__tests__/cardPositions.test.ts`    | Update helper and call sites; rewrite stale two-row tests; add new tests                      |
| `apps/client/src/components/game/PlayerHand.tsx`          | Update call site to pass `handCards` with suit                                                |
| `apps/client/src/components/game/TrickAnimationLayer.tsx` | Update call site (`handCardIds: []` → `handCards: []`)                                        |

---

## Task 1: Rename `handCardIds` → `handCards` (no behaviour change)

**Files:**

- Modify: `packages/game-canvas/src/cards/cardPositions.ts`
- Modify: `packages/game-canvas/__tests__/cardPositions.test.ts`
- Modify: `apps/client/src/components/game/PlayerHand.tsx`
- Modify: `apps/client/src/components/game/TrickAnimationLayer.tsx`

This task is purely mechanical: rename the field and update every reference so the code compiles and all existing tests still pass. No behaviour changes yet.

- [ ] **Step 1: Update `CardPositionsInput` in `cardPositions.ts`**

In `packages/game-canvas/src/cards/cardPositions.ts`, replace:

```typescript
export interface CardPositionsInput {
  handCardIds: string[];
  trickCardIds: TrickCardEntry[];
  wonPilePlayerIds: string[];
  opponentCardCounts: Record<string, number>;
}
```

with:

```typescript
export interface CardPositionsInput {
  handCards: { id: string; suit: string }[];
  trickCardIds: TrickCardEntry[];
  wonPilePlayerIds: string[];
  opponentCardCounts: Record<string, number>;
}
```

- [ ] **Step 2: Update `deriveCardPositions` internals to use `handCards`**

Replace every reference to `input.handCardIds` inside `deriveCardPositions`. The two-row block and single-row block both need updating. Use `.map(c => c.id)` or `card.id` inline to preserve the same behaviour for now.

Replace:

```typescript
const n = input.handCardIds.length;
const availableWidth = width - 2 * HAND_SIDE_MARGIN;
const isTwoRowMode = width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW;
```

with:

```typescript
const n = input.handCards.length;
const availableWidth = width - 2 * HAND_SIDE_MARGIN;
const isTwoRowMode = width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW;
```

Replace the two-row block opening:

```typescript
const bottomIds = input.handCardIds.slice(0, MAX_CARDS_PER_ROW);
const topIds = input.handCardIds.slice(MAX_CARDS_PER_ROW);
const bottomCount = bottomIds.length;
const topCount = topIds.length;
```

with (keep all other two-row code identical, just adapt forEach to use `.id`):

```typescript
const bottomCards = input.handCards.slice(0, MAX_CARDS_PER_ROW);
const topCards = input.handCards.slice(MAX_CARDS_PER_ROW);
const bottomCount = bottomCards.length;
const topCount = topCards.length;
```

Replace the two forEach calls in the two-row block:

```typescript
bottomIds.forEach((id, i) => {
  playerHand[id] = { ... };
});
// ...
topIds.forEach((id, i) => {
  playerHand[id] = { ... };
});
```

with:

```typescript
bottomCards.forEach((card, i) => {
  playerHand[card.id] = { ... };  // same body, just card.id instead of id
});
// ...
topCards.forEach((card, i) => {
  playerHand[card.id] = { ... };  // same body
});
```

Replace the single-row forEach:

```typescript
input.handCardIds.forEach((id, i) => {
  playerHand[id] = { ... };
});
```

with:

```typescript
input.handCards.forEach((card, i) => {
  playerHand[card.id] = { ... };  // same body
});
```

- [ ] **Step 3: Update the test helper in `cardPositions.test.ts`**

Replace:

```typescript
function makeInput(cardCount: number) {
  return {
    handCardIds: Array.from({ length: cardCount }, (_, i) => `card-${i}`),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}
```

with:

```typescript
const SUITS_CYCLE = ['kreuz', 'schippe', 'herz', 'bollen'] as const;

function makeInput(cardCount: number) {
  return {
    handCards: Array.from({ length: cardCount }, (_, i) => ({
      id: `card-${i}`,
      suit: SUITS_CYCLE[i % 4]!,
    })),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}
```

Note: cycling suits means adjacent cards always have different suits, so suit boundaries exist at every index. For `makeInput(12)` the split lands at index 6 (two rows of 6). For `makeInput(11)` it lands at index 5 (top=5, bottom=6). This is used in the later tasks.

- [ ] **Step 4: Update inline `handCardIds` usages in tests**

The test file has several inline objects that use `handCardIds`. Replace each one. The full list:

```typescript
// Every occurrence of this pattern:
handCardIds: ['c1', 'c2', 'c3'],
// becomes:
handCards: [
  { id: 'c1', suit: 'kreuz' },
  { id: 'c2', suit: 'schippe' },
  { id: 'c3', suit: 'herz' },
],

// And:
handCardIds: [],
// becomes:
handCards: [],
```

There are 6 inline usages: the two tests in `describe('deriveCardPositions')` and the four in `describe('deriveCardPositions – opponent hands')`.

- [ ] **Step 5: Update call site in `PlayerHand.tsx`**

In `apps/client/src/components/game/PlayerHand.tsx`, replace:

```typescript
const positions = deriveCardPositions(
  {
    handCardIds: displayedCards.map((c) => c.id),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  },
  layout
);
```

with:

```typescript
const positions = deriveCardPositions(
  {
    handCards: displayedCards.map((c) => ({ id: c.id, suit: c.suit })),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  },
  layout
);
```

- [ ] **Step 6: Update call site in `TrickAnimationLayer.tsx`**

In `apps/client/src/components/game/TrickAnimationLayer.tsx`, replace:

```typescript
{
  handCardIds: [],
  trickCardIds: displayCards.map(...),
  ...
}
```

with:

```typescript
{
  handCards: [],
  trickCardIds: displayCards.map(...),
  ...
}
```

- [ ] **Step 7: Run tests — expect all to pass**

```bash
pnpm test
```

Expected: all tests pass (no behaviour has changed, only the field name).

- [ ] **Step 8: Commit**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts \
        packages/game-canvas/__tests__/cardPositions.test.ts \
        apps/client/src/components/game/PlayerHand.tsx \
        apps/client/src/components/game/TrickAnimationLayer.tsx
git commit -m "refactor: rename handCardIds → handCards in CardPositionsInput"
```

---

## Task 2: Write failing tests for the new behaviour

**Files:**

- Modify: `packages/game-canvas/__tests__/cardPositions.test.ts`

Rewrite stale tests and add new ones that describe the desired behaviour. These will FAIL until Task 3 is complete.

- [ ] **Step 1: Rewrite stale test — `'places first MAX_CARDS_PER_ROW cards on the bottom row'`**

This test asserted the old (inverted) reading order. Replace it with:

```typescript
it('top row contains the first cards in sort order', () => {
  // makeInput(12) with cycling suits → split at index 6
  // card-0 through card-5 land in the top row (smaller Y)
  const result = deriveCardPositions(makeInput(12), mobileLayout);
  const topY = result.playerHand['card-0']!.y;
  const bottomY = result.playerHand['card-6']!.y;
  expect(topY).toBeLessThan(bottomY);
  for (let i = 0; i < 6; i++) {
    expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(topY, 1);
  }
});
```

- [ ] **Step 2: Rewrite stale test — `'places overflow cards on the top row'`**

Replace with:

```typescript
it('bottom row contains the later cards in sort order', () => {
  // makeInput(12) → cards 6–11 land in the bottom row (larger Y)
  const result = deriveCardPositions(makeInput(12), mobileLayout);
  const bottomY = result.playerHand['card-6']!.y;
  for (let i = 6; i < 12; i++) {
    expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(bottomY, 1);
  }
});
```

- [ ] **Step 3: Rewrite stale test — `'scales down when 12 cards overflow a 375px portrait phone'`**

The old test assumed scale was driven by a 10-card bottom row. With the new split (6+6 for makeInput(12)), scaling is driven by 6 cards, which fits a 375px screen without scaling. Replace the assertion body:

```typescript
it('scales down when a large row overflows a 375px portrait phone', () => {
  // 16 cards: 5 kreuz + 4 schippe + 4 herz + 3 bollen
  // Boundaries at 5, 9, 13 → closest to 8 is 9 → top row = 9 cards
  const layout = { width: 375, height: 812, playerCount: 3 as const };
  const input = {
    handCards: [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `kreuz-${i}`, suit: 'kreuz' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `schippe-${i}`, suit: 'schippe' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `herz-${i}`, suit: 'herz' })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `bollen-${i}`, suit: 'bollen' })),
    ],
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
  const result = deriveCardPositions(input, layout);
  expect(result.cardScale).toBeLessThan(1);
  // Scale is driven by the larger row (9 cards)
  const scaledW = CARD_WIDTH * result.cardScale;
  const scaledOverlap = CARD_OVERLAP * result.cardScale;
  const largerRowWidth = 9 * scaledW - 8 * scaledOverlap;
  expect(largerRowWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5);
});
```

- [ ] **Step 4: Rewrite stale test — `'bottom-anchors the hand so it never goes off-screen'`**

The old test checked `card-0` (which is now in the top row, not at the screen bottom). Replace with a check on the bottom row:

```typescript
it('bottom-anchors the hand so it never goes off-screen', () => {
  const layout = { width: 375, height: 812, playerCount: 3 as const };
  const result = deriveCardPositions(makeInput(12), layout);
  const scaledH = CARD_HEIGHT * result.cardScale;
  // makeInput(12) splits at 6 → card-6 is the first card of the bottom row
  const bottomCard = result.playerHand['card-6']!;
  expect(bottomCard.y + scaledH).toBeLessThanOrEqual(812);
});
```

- [ ] **Step 5: Update test — `'each row is independently centered horizontally'`**

Card indices changed (split is now at 6, not 10). Replace the index references:

```typescript
it('each row is independently centered horizontally', () => {
  // makeInput(12) → top row: cards 0–5, bottom row: cards 6–11
  const result = deriveCardPositions(makeInput(12), mobileLayout);
  const scaledW = CARD_WIDTH * result.cardScale;

  // Top row: cards 0–5
  const topFirst = result.playerHand['card-0']!.x;
  const topLast = result.playerHand['card-5']!.x;
  const topCenter = (topFirst + topLast + scaledW) / 2;
  expect(topCenter).toBeCloseTo(mobileLayout.width / 2, 0);

  // Bottom row: cards 6–11
  const bottomFirst = result.playerHand['card-6']!.x;
  const bottomLast = result.playerHand['card-11']!.x;
  const bottomCenter = (bottomFirst + bottomLast + scaledW) / 2;
  expect(bottomCenter).toBeCloseTo(mobileLayout.width / 2, 0);
});
```

- [ ] **Step 6: Update test — `'each row fans independently — symmetric rotation around its own midpoint'`**

```typescript
it('each row fans independently — symmetric rotation around its own midpoint', () => {
  // makeInput(12) → top: cards 0–5, bottom: cards 6–11
  const result = deriveCardPositions(makeInput(12), mobileLayout);

  // Top row: first and last cards have equal-magnitude, opposite-sign rotations
  const topFirst = result.playerHand['card-0']!.rotation;
  const topLast = result.playerHand['card-5']!.rotation;
  expect(topFirst + topLast).toBeCloseTo(0, 5);

  // Bottom row: symmetric
  const bottomFirst = result.playerHand['card-6']!.rotation;
  const bottomLast = result.playerHand['card-11']!.rotation;
  expect(bottomFirst + bottomLast).toBeCloseTo(0, 5);
});
```

- [ ] **Step 7: Update test — `'bottom row cards have higher z-index than top row cards'`**

```typescript
it('bottom row cards have higher z-index than top row cards', () => {
  // makeInput(12) → top: cards 0–5, bottom: cards 6–11
  const result = deriveCardPositions(makeInput(12), mobileLayout);
  const topZIndices = Array.from({ length: 6 }, (_, i) => result.playerHand[`card-${i}`]!.zIndex);
  const bottomZIndices = Array.from(
    { length: 6 },
    (_, i) => result.playerHand[`card-${6 + i}`]!.zIndex
  );
  const maxTopZ = Math.max(...topZIndices);
  const minBottomZ = Math.min(...bottomZIndices);
  expect(minBottomZ).toBeGreaterThan(maxTopZ);
});
```

- [ ] **Step 8: Update test — `'top row y equals bottomY minus (1 - ROW_OVERLAP) * scaledH'`**

```typescript
it('top row y equals bottomY minus (1 - ROW_OVERLAP) * scaledH', () => {
  // makeInput(12) → card-0 is in top row, card-6 is in bottom row
  const result = deriveCardPositions(makeInput(12), mobileLayout);
  const scaledH = CARD_HEIGHT * result.cardScale;
  const topY = result.playerHand['card-0']!.y;
  const bottomY = result.playerHand['card-6']!.y;
  const expectedTopY = bottomY - scaledH * (1 - ROW_OVERLAP);
  expect(topY).toBeCloseTo(expectedTopY, 1);
});
```

- [ ] **Step 9: Update test — `'activates two-row mode on narrow screen with more than MAX_CARDS_PER_ROW cards'`**

```typescript
it('activates two-row mode on narrow screen with more than MAX_CARDS_PER_ROW cards', () => {
  // makeInput(11) → split at 5 → top row: cards 0–4, bottom row: cards 5–10
  const result = deriveCardPositions(makeInput(11), mobileLayout);
  const topY = result.playerHand['card-0']!.y; // first card is in top row
  const bottomY = result.playerHand['card-10']!.y; // last card is in bottom row
  expect(topY).toBeLessThan(bottomY);
});
```

- [ ] **Step 10: Add new test — suits stay together**

Append to the `describe('deriveCardPositions — two-row hand layout')` block:

```typescript
it('keeps all cards of the same suit in the same row', () => {
  // 12 cards: 3 per suit, sorted → boundaries at 3, 6, 9 → split at 6
  // kreuz+schippe in top row; herz+bollen in bottom row
  const input = {
    handCards: [
      { id: 'k0', suit: 'kreuz' },
      { id: 'k1', suit: 'kreuz' },
      { id: 'k2', suit: 'kreuz' },
      { id: 's0', suit: 'schippe' },
      { id: 's1', suit: 'schippe' },
      { id: 's2', suit: 'schippe' },
      { id: 'h0', suit: 'herz' },
      { id: 'h1', suit: 'herz' },
      { id: 'h2', suit: 'herz' },
      { id: 'b0', suit: 'bollen' },
      { id: 'b1', suit: 'bollen' },
      { id: 'b2', suit: 'bollen' },
    ],
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
  const result = deriveCardPositions(input, mobileLayout);

  const kreuzY = result.playerHand['k0']!.y;
  const schippeY = result.playerHand['s0']!.y;
  const herzY = result.playerHand['h0']!.y;
  const bollenY = result.playerHand['b0']!.y;

  // All kreuz cards on the same row
  expect(result.playerHand['k1']!.y).toBeCloseTo(kreuzY, 1);
  expect(result.playerHand['k2']!.y).toBeCloseTo(kreuzY, 1);
  // kreuz and schippe share the top row
  expect(schippeY).toBeCloseTo(kreuzY, 1);
  // herz and bollen share the bottom row
  expect(result.playerHand['h1']!.y).toBeCloseTo(herzY, 1);
  expect(bollenY).toBeCloseTo(herzY, 1);
  // Top row (kreuz) is higher than bottom row (herz)
  expect(kreuzY).toBeLessThan(herzY);
});
```

- [ ] **Step 11: Add new test — graceful degradation (all same suit)**

```typescript
it('falls back to ceil(n/2) split when all cards are the same suit', () => {
  const input = {
    handCards: Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, suit: 'kreuz' })),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
  const result = deriveCardPositions(input, mobileLayout);

  // ceil(12/2) = 6 → top row: k0–k5, bottom row: k6–k11
  const topY = result.playerHand['k0']!.y;
  const bottomY = result.playerHand['k6']!.y;

  for (let i = 0; i < 6; i++) {
    expect(result.playerHand[`k${i}`]!.y).toBeCloseTo(topY, 1);
  }
  for (let i = 6; i < 12; i++) {
    expect(result.playerHand[`k${i}`]!.y).toBeCloseTo(bottomY, 1);
  }
  expect(topY).toBeLessThan(bottomY);
});
```

- [ ] **Step 12: Run tests — expect the two-row tests to fail**

```bash
pnpm test
```

Expected: tests in `describe('deriveCardPositions — two-row hand layout')` fail because the implementation still uses the old fixed-index split. Tests outside that describe block should still pass.

---

## Task 3: Implement suit-boundary split

**Files:**

- Modify: `packages/game-canvas/src/cards/cardPositions.ts`

- [ ] **Step 1: Add `findSuitBoundarySplit` above `deriveCardPositions`**

Insert this function before `deriveCardPositions`:

```typescript
/**
 * Given a sorted hand, returns the index at which to split into top and bottom rows.
 * Picks the suit boundary closest to n/2. Ties favour the smaller index (larger top row).
 * Falls back to Math.ceil(n/2) when all cards share one suit.
 */
function findSuitBoundarySplit(cards: { id: string; suit: string }[]): number {
  const n = cards.length;
  const boundaries: number[] = [];
  for (let i = 1; i < n; i++) {
    if (cards[i]!.suit !== cards[i - 1]!.suit) {
      boundaries.push(i);
    }
  }
  if (boundaries.length === 0) {
    return Math.ceil(n / 2);
  }
  const target = n / 2;
  let best = boundaries[0]!;
  for (const b of boundaries) {
    const bDist = Math.abs(b - target);
    const bestDist = Math.abs(best - target);
    if (bDist < bestDist || (bDist === bestDist && b < best)) {
      best = b;
    }
  }
  return best;
}
```

- [ ] **Step 2: Replace the two-row block in `deriveCardPositions`**

Replace the entire `if (isTwoRowMode) { ... }` block with:

```typescript
if (isTwoRowMode) {
  const splitIndex = findSuitBoundarySplit(input.handCards);
  const topCards = input.handCards.slice(0, splitIndex); // first suits → top row (read first)
  const bottomCards = input.handCards.slice(splitIndex); // later suits → bottom row (read second)
  const topCount = topCards.length;
  const bottomCount = bottomCards.length;
  const largerCount = Math.max(topCount, bottomCount);

  // Scale driven by the larger row
  const largerNaturalWidth = largerCount * CARD_WIDTH - Math.max(0, largerCount - 1) * CARD_OVERLAP;
  cardScale = n === 0 ? 1 : Math.min(1, availableWidth / largerNaturalWidth);

  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const scaledOverlap = CARD_OVERLAP * cardScale;

  // Bottom row — later suits, rendered lower (closer to player), higher z-index
  const bottomTotalWidth = bottomCount * scaledW - Math.max(0, bottomCount - 1) * scaledOverlap;
  const bottomStartX = (width - bottomTotalWidth) / 2;
  const bottomY = height - scaledH - HAND_BOTTOM_MARGIN;

  bottomCards.forEach((card, i) => {
    playerHand[card.id] = {
      x: bottomStartX + i * (scaledW - scaledOverlap),
      y: bottomY,
      rotation: (i - (bottomCount - 1) / 2) * 1.8,
      zIndex: topCount + i,
    };
  });

  // Top row — first suits, rendered higher, lower z-index (partially behind bottom row)
  const topTotalWidth = topCount * scaledW - Math.max(0, topCount - 1) * scaledOverlap;
  const topStartX = (width - topTotalWidth) / 2;
  const topY = bottomY - scaledH * (1 - ROW_OVERLAP);

  topCards.forEach((card, i) => {
    playerHand[card.id] = {
      x: topStartX + i * (scaledW - scaledOverlap),
      y: topY,
      rotation: (i - (topCount - 1) / 2) * 1.8,
      zIndex: i,
    };
  });
}
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Run full CI check**

```bash
pnpm run build && pnpm lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts \
        packages/game-canvas/__tests__/cardPositions.test.ts
git commit -m "feat: suit-aware two-row hand layout with natural reading order"
```
