# Hand Two-Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the screen is narrower than 480 px and the player holds more than 10 cards, split the hand into two overlapping rows instead of scaling cards down to illegibility.

**Architecture:** All logic lives in `deriveCardPositions` in `cardPositions.ts` (a pure function). When `width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW`, the first 10 cards go on the bottom row and overflow cards go on the top row. Each row fans independently; both rows share the scale factor derived from the bottom row; bottom-row cards have higher z-indices than top-row cards. No other files change.

**Tech Stack:** TypeScript, Vitest (tests). React Native / Reanimated are downstream consumers — no changes needed there.

---

## File Map

| File                                                   | Change                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`      | Add 3 constants; add two-row branch inside `deriveCardPositions` |
| `packages/game-canvas/__tests__/cardPositions.test.ts` | Add `describe` block with 9 new two-row tests                    |

---

## Task 1: Add failing tests for two-row layout

**Files:**

- Modify: `packages/game-canvas/__tests__/cardPositions.test.ts`

These tests will all fail until the implementation is added in Task 2.

- [ ] **Step 1: Add two-row test constants near the top of the test file**

Open `packages/game-canvas/__tests__/cardPositions.test.ts` and add these constants directly below the existing `HAND_SIDE_MARGIN` constant (after line 8):

```typescript
const MOBILE_BREAKPOINT_WIDTH = 480;
const MAX_CARDS_PER_ROW = 10;
const ROW_OVERLAP = 0.4;
```

- [ ] **Step 2: Append the new describe block at the end of the file**

```typescript
describe('deriveCardPositions — two-row hand layout', () => {
  const mobileLayout = { width: 375, height: 812, playerCount: 3 as const };
  const wideLayout = { width: 800, height: 812, playerCount: 3 as const };

  it('activates two-row mode on narrow screen with more than MAX_CARDS_PER_ROW cards', () => {
    // 11 cards on 375px → bottom row 10, top row 1
    const result = deriveCardPositions(makeInput(11), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    const topY = result.playerHand['card-10']!.y;
    expect(topY).toBeLessThan(bottomY);
  });

  it('does not activate two-row mode on wide screen', () => {
    // 800px is above MOBILE_BREAKPOINT_WIDTH → all cards same y
    const result = deriveCardPositions(makeInput(11), wideLayout);
    const ys = Array.from({ length: 11 }, (_, i) => result.playerHand[`card-${i}`]!.y);
    const allSameY = ys.every((y) => Math.abs(y - ys[0]!) < 0.5);
    expect(allSameY).toBe(true);
  });

  it('does not activate two-row mode when cards <= MAX_CARDS_PER_ROW', () => {
    // 10 cards on 375px → single row, all same y
    const result = deriveCardPositions(makeInput(MAX_CARDS_PER_ROW), mobileLayout);
    const ys = Array.from(
      { length: MAX_CARDS_PER_ROW },
      (_, i) => result.playerHand[`card-${i}`]!.y
    );
    const allSameY = ys.every((y) => Math.abs(y - ys[0]!) < 0.5);
    expect(allSameY).toBe(true);
  });

  it('places first MAX_CARDS_PER_ROW cards on the bottom row', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    for (let i = 0; i < MAX_CARDS_PER_ROW; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(bottomY, 1);
    }
  });

  it('places overflow cards on the top row', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    for (let i = MAX_CARDS_PER_ROW; i < 12; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeLessThan(bottomY);
    }
  });

  it('top row y equals bottomY minus (1 - ROW_OVERLAP) * scaledH', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledH = CARD_HEIGHT * result.cardScale;
    const bottomY = result.playerHand['card-0']!.y;
    const topY = result.playerHand['card-10']!.y;
    const expectedTopY = bottomY - scaledH * (1 - ROW_OVERLAP);
    expect(topY).toBeCloseTo(expectedTopY, 1);
  });

  it('bottom row cards have higher z-index than top row cards', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomZIndices = Array.from(
      { length: MAX_CARDS_PER_ROW },
      (_, i) => result.playerHand[`card-${i}`]!.zIndex
    );
    const topZIndices = Array.from(
      { length: 2 },
      (_, i) => result.playerHand[`card-${MAX_CARDS_PER_ROW + i}`]!.zIndex
    );
    const minBottomZ = Math.min(...bottomZIndices);
    const maxTopZ = Math.max(...topZIndices);
    expect(minBottomZ).toBeGreaterThan(maxTopZ);
  });

  it('each row is independently centered horizontally', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledW = CARD_WIDTH * result.cardScale;
    const scaledOverlap = CARD_OVERLAP * result.cardScale;

    // Bottom row: cards 0–9
    const bottomFirst = result.playerHand['card-0']!.x;
    const bottomLast = result.playerHand[`card-${MAX_CARDS_PER_ROW - 1}`]!.x;
    const bottomCenter = (bottomFirst + bottomLast + scaledW) / 2;
    expect(bottomCenter).toBeCloseTo(mobileLayout.width / 2, 0);

    // Top row: cards 10–11
    const topFirst = result.playerHand['card-10']!.x;
    const topLast = result.playerHand['card-11']!.x;
    const topCenter = (topFirst + topLast + scaledW) / 2;
    expect(topCenter).toBeCloseTo(mobileLayout.width / 2, 0);
  });

  it('each row fans independently — symmetric rotation around its own midpoint', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);

    // Bottom row first and last card should have equal-magnitude, opposite-sign rotations
    const bottomFirst = result.playerHand['card-0']!.rotation;
    const bottomLast = result.playerHand[`card-${MAX_CARDS_PER_ROW - 1}`]!.rotation;
    expect(bottomFirst + bottomLast).toBeCloseTo(0, 5);

    // Top row: cards 10 and 11 (2 cards, symmetric)
    const topFirst = result.playerHand['card-10']!.rotation;
    const topLast = result.playerHand['card-11']!.rotation;
    expect(topFirst + topLast).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 3: Update the existing scaling test to match two-row behaviour (before running any new tests)**

The test `scales down when 12 cards overflow a 375px portrait phone` (around line 95 of the test file) currently checks that all 12 cards fit in `availableWidth` at the computed scale. In two-row mode the scale is derived from the 10-card bottom row, so the 12-card width check will fail. Replace the width assertion to check the **bottom row** (10 cards) fits instead:

Find this block:

```typescript
it('scales down when 12 cards overflow a 375px portrait phone', () => {
  const layout = { width: 375, height: 812, playerCount: 3 as const };
  const result = deriveCardPositions(makeInput(12), layout);
  expect(result.cardScale).toBeLessThan(1);
  const n = 12;
  const scaledW = CARD_WIDTH * result.cardScale;
  const scaledOverlap = CARD_OVERLAP * result.cardScale;
  const handWidth = n * scaledW - (n - 1) * scaledOverlap;
  expect(handWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5);
});
```

Replace with:

```typescript
it('scales down when 12 cards overflow a 375px portrait phone', () => {
  const layout = { width: 375, height: 812, playerCount: 3 as const };
  const result = deriveCardPositions(makeInput(12), layout);
  expect(result.cardScale).toBeLessThan(1);
  // In two-row mode cardScale is derived from the bottom row (MAX_CARDS_PER_ROW cards)
  const n = MAX_CARDS_PER_ROW;
  const scaledW = CARD_WIDTH * result.cardScale;
  const scaledOverlap = CARD_OVERLAP * result.cardScale;
  const handWidth = n * scaledW - (n - 1) * scaledOverlap;
  expect(handWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5);
});
```

- [ ] **Step 4: Run the new tests to confirm they all fail**

```bash
pnpm --filter @dabb/game-canvas test -- --reporter=verbose 2>&1 | tail -40
```

Expected: 9 failures in the `two-row hand layout` describe block. All other tests still pass.

- [ ] **Step 5: Commit the failing tests**

```bash
git add packages/game-canvas/__tests__/cardPositions.test.ts
git commit -m "test(game-canvas): add failing tests for two-row hand layout"
```

---

## Task 2: Implement two-row layout in deriveCardPositions

**Files:**

- Modify: `packages/game-canvas/src/cards/cardPositions.ts`

- [ ] **Step 1: Add the three new constants**

In `packages/game-canvas/src/cards/cardPositions.ts`, add after the last constant in the top block — after `TRICK_ROTATIONS` (around line 49), before `WON_PILE_CORNERS`:

```typescript
const MOBILE_BREAKPOINT_WIDTH = 480;
const MAX_CARDS_PER_ROW = 10;
const ROW_OVERLAP = 0.4;
```

- [ ] **Step 2: Replace the player-hand section with a two-row-aware version**

The current player-hand section spans lines 65–87. Replace it entirely with:

```typescript
// Player hand — two-row mode on narrow screens when hand exceeds MAX_CARDS_PER_ROW
const isTwoRowMode = width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW;

const playerHand: Record<string, CardPosition> = {};
let cardScale: number;

if (isTwoRowMode) {
  const bottomIds = input.handCardIds.slice(0, MAX_CARDS_PER_ROW);
  const topIds = input.handCardIds.slice(MAX_CARDS_PER_ROW);
  const bottomCount = bottomIds.length;
  const topCount = topIds.length;

  // Scale driven by the bottom row (more cards → more constrained)
  const bottomNaturalWidth = bottomCount * CARD_WIDTH - Math.max(0, bottomCount - 1) * CARD_OVERLAP;
  cardScale = n === 0 ? 1 : Math.min(1, availableWidth / bottomNaturalWidth);

  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const scaledOverlap = CARD_OVERLAP * cardScale;

  // Bottom row
  const bottomTotalWidth = bottomCount * scaledW - Math.max(0, bottomCount - 1) * scaledOverlap;
  const bottomStartX = (width - bottomTotalWidth) / 2;
  const bottomY = height - scaledH - HAND_BOTTOM_MARGIN;

  bottomIds.forEach((id, i) => {
    playerHand[id] = {
      x: bottomStartX + i * (scaledW - scaledOverlap),
      y: bottomY,
      rotation: (i - (bottomCount - 1) / 2) * 1.8,
      zIndex: topCount + i,
    };
  });

  // Top row — overlaps bottom row by ROW_OVERLAP fraction of card height
  const topTotalWidth = topCount * scaledW - Math.max(0, topCount - 1) * scaledOverlap;
  const topStartX = (width - topTotalWidth) / 2;
  const topY = bottomY - scaledH * (1 - ROW_OVERLAP);

  topIds.forEach((id, i) => {
    playerHand[id] = {
      x: topStartX + i * (scaledW - scaledOverlap),
      y: topY,
      rotation: (i - (topCount - 1) / 2) * 1.8,
      zIndex: i,
    };
  });
} else {
  // Single-row — original logic
  const naturalWidth = n * CARD_WIDTH - Math.max(0, n - 1) * CARD_OVERLAP;
  cardScale = n === 0 ? 1 : Math.min(1, availableWidth / naturalWidth);

  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const scaledOverlap = CARD_OVERLAP * cardScale;

  const handTotalWidth = n * scaledW - Math.max(0, n - 1) * scaledOverlap;
  const handStartX = (width - handTotalWidth) / 2;
  const handY = height - scaledH - HAND_BOTTOM_MARGIN;

  input.handCardIds.forEach((id, i) => {
    playerHand[id] = {
      x: handStartX + i * (scaledW - scaledOverlap),
      y: handY,
      rotation: (i - (n - 1) / 2) * 1.8,
      zIndex: i,
    };
  });
}
```

Also update the `return` statement to use the new `cardScale` variable (it is now declared with `let` inside the if/else, so the existing `return { playerHand, trickCards, wonPiles, opponentHands, cardScale }` at line 121 works unchanged — verify it still references `cardScale`).

- [ ] **Step 3: Run all tests and verify they pass**

```bash
pnpm --filter @dabb/game-canvas test -- --reporter=verbose 2>&1 | tail -50
```

Expected: all tests pass, including the 9 new two-row tests.

- [ ] **Step 4: Run the full CI suite**

```bash
pnpm run build 2>&1 | tail -20
pnpm lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit the implementation**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts
git commit -m "feat(game-canvas): two-row hand layout on narrow mobile screens"
```
