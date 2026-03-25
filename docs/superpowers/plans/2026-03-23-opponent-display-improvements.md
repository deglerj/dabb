# Opponent Display Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spread opponents evenly across the top of the table and replace green placeholder card backs with the real textured card back component.

**Architecture:** Export a shared `edgeFraction(i, n)` helper from `@dabb/game-canvas` and use it both in `cardPositions.ts` (animation origins) and `GameScreen.tsx` (visual zone placement) to keep both in sync. Create a new `CardBackView` component that wraps the existing `CardBack` in a sized `View` so it can be used in React Native flex layouts.

**Tech Stack:** TypeScript, React Native, `@shopify/react-native-skia`, Vitest

---

## File Map

| File                                                   | Action | Purpose                                                   |
| ------------------------------------------------------ | ------ | --------------------------------------------------------- |
| `packages/game-canvas/src/cards/cardPositions.ts`      | Modify | Add and export `edgeFraction`; replace opponent x formula |
| `packages/game-canvas/src/cards/CardBackView.tsx`      | Create | Sized `View` wrapper around `CardBack` for flex layouts   |
| `packages/game-canvas/index.ts`                        | Modify | Export `edgeFraction` and `CardBackView`                  |
| `apps/client/src/components/game/OpponentZone.tsx`     | Modify | Use `CardBackView`; remove portrait count badge           |
| `apps/client/src/components/ui/GameScreen.tsx`         | Modify | Update `computeOpponentPositions` to use `edgeFraction`   |
| `packages/game-canvas/__tests__/cardPositions.test.ts` | Modify | Add `edgeFraction` unit tests                             |

---

## Task 1: Add `edgeFraction` helper and update opponent positions in `cardPositions.ts`

**Files:**

- Modify: `packages/game-canvas/__tests__/cardPositions.test.ts`
- Modify: `packages/game-canvas/src/cards/cardPositions.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/game-canvas/__tests__/cardPositions.test.ts`. First, update the existing import at the top of the file from:

```typescript
import { deriveCardPositions, type LayoutDimensions } from '../src/cards/cardPositions.js';
```

to:

```typescript
import {
  deriveCardPositions,
  edgeFraction,
  type LayoutDimensions,
} from '../src/cards/cardPositions.js';
```

Then append the new test blocks at the end of the file:

```typescript
describe('edgeFraction', () => {
  it('returns 0.5 for a single opponent', () => {
    expect(edgeFraction(0, 1)).toBe(0.5);
  });

  it('maps two opponents to 15% and 85%', () => {
    expect(edgeFraction(0, 2)).toBeCloseTo(0.15);
    expect(edgeFraction(1, 2)).toBeCloseTo(0.85);
  });

  it('maps three opponents to 15%, 50%, 85%', () => {
    expect(edgeFraction(0, 3)).toBeCloseTo(0.15);
    expect(edgeFraction(1, 3)).toBeCloseTo(0.5);
    expect(edgeFraction(2, 3)).toBeCloseTo(0.85);
  });
});

describe('deriveCardPositions – opponent hands', () => {
  it('places a single opponent at 50% of width', () => {
    const result = deriveCardPositions(
      { handCardIds: [], trickCardIds: [], wonPilePlayerIds: [], opponentCardCounts: { p1: 8 } },
      LAYOUT
    );
    expect(result.opponentHands['p1']?.x).toBeCloseTo(LAYOUT.width * 0.5);
  });

  it('places two opponents at 15% and 85% of width', () => {
    const result = deriveCardPositions(
      {
        handCardIds: [],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: { p1: 8, p2: 8 },
      },
      LAYOUT
    );
    expect(result.opponentHands['p1']?.x).toBeCloseTo(LAYOUT.width * 0.15);
    expect(result.opponentHands['p2']?.x).toBeCloseTo(LAYOUT.width * 0.85);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @dabb/game-canvas test -- --reporter=verbose 2>&1 | grep -E "FAIL|edgeFraction|opponent hands"
```

Expected: tests fail with `edgeFraction is not a function` or similar.

- [ ] **Step 3: Add `edgeFraction` to `cardPositions.ts` and update the formula**

In `packages/game-canvas/src/cards/cardPositions.ts`, add this function before `deriveCardPositions`:

```typescript
/**
 * Maps opponent index i (0-based, out of n total opponents) to an x-fraction
 * in the range [0.15, 0.85], giving clear edge-to-edge spread.
 * Single opponent is centered at 0.5.
 */
export function edgeFraction(i: number, n: number): number {
  const lo = 0.15,
    hi = 0.85;
  if (n <= 1) return 0.5;
  return lo + (i / (n - 1)) * (hi - lo);
}
```

Then in `deriveCardPositions`, replace the opponent hands block (currently lines 161–171):

```typescript
// Opponent hands — edge-push formula: 15%–85% of canvas width
const opponentIds = Object.keys(input.opponentCardCounts);
const opponentHands: Record<string, { x: number; y: number; cardCount: number }> = {};
opponentIds.forEach((id, i) => {
  opponentHands[id] = {
    x: width * edgeFraction(i, opponentIds.length),
    y: height * 0.08,
    cardCount: input.opponentCardCounts[id] ?? 0,
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @dabb/game-canvas test -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|edgeFraction|opponent"
```

Expected: all tests pass.

- [ ] **Step 5: Export `edgeFraction` from the barrel**

In `packages/game-canvas/index.ts`, add to the Cards section:

```typescript
export { edgeFraction } from './src/cards/cardPositions.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts \
        packages/game-canvas/index.ts \
        packages/game-canvas/__tests__/cardPositions.test.ts
git commit -m "feat(game-canvas): add edgeFraction helper and update opponent positions"
```

---

## Task 2: Create `CardBackView` component

**Files:**

- Create: `packages/game-canvas/src/cards/CardBackView.tsx`
- Modify: `packages/game-canvas/index.ts`

No Vitest test needed — this is a thin wrapper around an already-tested Skia component that cannot run in a jsdom environment.

- [ ] **Step 1: Create `CardBackView.tsx`**

Create `packages/game-canvas/src/cards/CardBackView.tsx`:

```typescript
/**
 * CardBackView — wraps CardBack in a sized View so it participates in
 * flex/flow layouts (CardBack uses position:absolute internally).
 */
import React from 'react';
import { View } from 'react-native';
import { CardBack } from './CardBack.js';

export interface CardBackViewProps {
  width: number;
  height: number;
}

export function CardBackView({ width, height }: CardBackViewProps) {
  return (
    <View style={{ width, height }}>
      <CardBack width={width} height={height} />
    </View>
  );
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/game-canvas/index.ts`, add to the Cards section:

```typescript
export { CardBackView } from './src/cards/CardBackView.js';
export type { CardBackViewProps } from './src/cards/CardBackView.js';
```

- [ ] **Step 3: Verify the package builds**

```bash
pnpm --filter @dabb/game-canvas build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/cards/CardBackView.tsx \
        packages/game-canvas/index.ts
git commit -m "feat(game-canvas): add CardBackView wrapper component"
```

---

## Task 3: Update `OpponentZone` — real card backs, remove count badge

**Files:**

- Modify: `apps/client/src/components/game/OpponentZone.tsx`

- [ ] **Step 1: Update `OpponentZone.tsx`**

Replace the entire file content with:

```typescript
/**
 * OpponentZone — renders a single opponent's area on the table.
 * Landscape/tablet: nameplate + fanned card backs.
 * Portrait phone: nameplate only.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardBackView } from '@dabb/game-canvas';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';
import type { PlayerIndex } from '@dabb/shared-types';

export interface OpponentZoneProps {
  playerIndex: PlayerIndex;
  nickname: string;
  cardCount: number;
  isConnected: boolean;
  position: { x: number; y: number };
}

const CARD_W = 40;
const CARD_H = 60;

export function OpponentZone({ nickname, cardCount, isConnected, position }: OpponentZoneProps) {
  const { width, height } = useGameDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) > 600;
  const showCards = isLandscape || isTablet;

  return (
    <View style={[styles.container, { left: position.x - 40, top: position.y - 20 }]}>
      <View style={styles.nameplate}>
        <Text style={styles.name} numberOfLines={1}>
          {nickname}
        </Text>
        {!isConnected && <Text style={styles.offlineBadge}>(offline)</Text>}
      </View>
      {showCards && cardCount > 0 && (
        <View style={styles.cardFan}>
          {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
            <View key={i} style={{ marginLeft: i === 0 ? 0 : -28 }}>
              <CardBackView width={CARD_W} height={CARD_H} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', alignItems: 'center', gap: 4 },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f2e8d0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  name: { fontSize: 14, color: '#3d2e18', maxWidth: 80 },
  offlineBadge: { fontSize: 11, color: '#999' },
  cardFan: { flexDirection: 'row' },
});
```

- [ ] **Step 2: Verify types**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/OpponentZone.tsx
git commit -m "feat(client): use CardBackView in OpponentZone, remove count badge"
```

---

## Task 4: Update `GameScreen` — responsive opponent positions

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Update `computeOpponentPositions` and its call site**

In `apps/client/src/components/ui/GameScreen.tsx`:

1. Add `edgeFraction` to the import from `@dabb/game-canvas`:

```typescript
import {
  GameTable,
  useSkiaEffects,
  PhaseOverlay,
  BiddingOverlay,
  DabbOverlay,
  TrumpOverlay,
  MeldingOverlay,
  edgeFraction,
} from '@dabb/game-canvas';
```

2. Replace the `computeOpponentPositions` function (lines 58–86) with:

```typescript
/**
 * Compute opponent positions based on player count and screen dimensions.
 * Returns a map from opponent seat index to {x,y} pixel coordinates.
 * x uses the edge-push formula (15%–85%), y is 8% from the top.
 */
function computeOpponentPositions(
  playerCount: number,
  myIndex: PlayerIndex,
  width: number,
  height: number
): Map<PlayerIndex, { x: number; y: number }> {
  const positions = new Map<PlayerIndex, { x: number; y: number }>();
  const opponents: PlayerIndex[] = [];

  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex) {
      opponents.push(i as PlayerIndex);
    }
  }

  opponents.forEach((opIdx, i) => {
    positions.set(opIdx, {
      x: width * edgeFraction(i, opponents.length),
      y: height * 0.08,
    });
  });

  return positions;
}
```

3. Update the `useMemo` call (around line 205) to pass `width` and `height`:

```typescript
const opponentPositions = useMemo(
  () => computeOpponentPositions(state.playerCount, playerIndex, width, height),
  [state.playerCount, playerIndex, width, height]
);
```

- [ ] **Step 2: Verify types and build**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat(client): use edgeFraction for responsive opponent positions"
```

---

## Task 5: Full CI check

- [ ] **Step 1: Run the full CI suite**

Use the `/ci-check` skill to run build + lint + tests exactly as CI does.

- [ ] **Step 2: Fix any failures before marking complete**
