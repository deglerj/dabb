# game-canvas Package Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/game-canvas` — a shared React Native + Skia game rendering package consumed by the unified `apps/client` app.

**Architecture:** Skia canvas handles static table background and dynamic visual effects (shadows, ripples, particles). Cards are animated React Native Views driven by Reanimated 4 shared values with bezier arc paths. Phase UI overlays are standard RN Views with spring entrance/exit animations.

**Tech Stack:** @shopify/react-native-skia, react-native-reanimated v4, react-native-gesture-handler v2, vitest (pure logic tests), TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-03-12-game-ui-rewrite-design.md`

**Note:** This is Plan 1 of 2. Plan 2 (`apps/client`) builds the unified app that consumes this package.

**Source-only package:** This package exports raw `.ts`/`.tsx` source (no build step, no `dist/`). Expo's Metro bundler resolves TypeScript source from workspace packages directly. This matches how `apps/mobile` already consumes other `@dabb/*` packages in development.

---

## File Map

```
packages/game-canvas/
  package.json                        ← @dabb/game-canvas, peer deps: skia, reanimated, rngh
  tsconfig.json                       ← extends ../../tsconfig.base.json, noEmit:true
  vitest.config.ts                    ← node environment, covers src/**/*.ts only
  index.ts                            ← public API exports
  src/
    table/
      shaders.ts                      ← Skia shader source strings (felt noise, wood grain)
      GameTable.tsx                   ← Full-bleed Skia <Canvas> background component
      useSkiaEffects.ts               ← Imperative hook: trigger shadow/ripple/particles
    cards/
      CardFace.tsx                    ← Antique paper card face (rank + suit + face illustrations)
      CardBack.tsx                    ← Card back (cached Skia Picture, diagonal hatching)
      CardView.tsx                    ← Animated RN View wrapping CardFace or CardBack
      dragGesture.ts                  ← Tap + Pan gesture factory
      cardPositions.ts                ← Pure fn: derives {x,y,rotation,zIndex} from game input
    animations/
      arcPath.ts                      ← Pure fns: arcX(t), arcY(t), interpolateArc()
      dealSequence.ts                 ← Pure fn: computeDealSchedule()
      trickSweep.ts                   ← Pure fn: computeSweepSchedule()
    overlays/
      PhaseOverlay.tsx                ← Floating paper-slip container with spring enter/exit
      BiddingOverlay.tsx              ← Bid buttons + current bid display
      DabbOverlay.tsx                 ← Take-dabb step + discard/go-out step (two sub-states)
      TrumpOverlay.tsx                ← 4 suit coin tokens
      MeldingOverlay.tsx              ← Meld list + confirm button
  __tests__/
    arcPath.test.ts                   ← Unit: arc math produces correct midpoint lift
    cardPositions.test.ts             ← Unit: positions derived correctly from input
    dealSequence.test.ts              ← Unit: stagger timing logic
    trickSweep.test.ts                ← Unit: sweep destination + timing
```

**Note on face card illustrations:** `CardFace.tsx` uses emoji placeholders for König/Ober/Buabe. The SVG face illustrations from the old apps will be moved to `packages/card-assets` in Plan 2 and wired in there.

---

## Chunk 1: Package Foundation + Arc Math + Card Positions

### Task 1: Create package skeleton

**Files:**

- Create: `packages/game-canvas/package.json`
- Create: `packages/game-canvas/tsconfig.json`
- Create: `packages/game-canvas/vitest.config.ts`
- Create: `packages/game-canvas/index.ts`

- [ ] **Step 1: Confirm workspace glob covers new package**

```bash
cat pnpm-workspace.yaml
```

Expected: `apps/*` and `packages/*` are listed. `packages/game-canvas` will be auto-discovered. No changes needed.

- [ ] **Step 2: Create `packages/game-canvas/package.json`**

```json
{
  "name": "@dabb/game-canvas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@dabb/card-assets": "workspace:*",
    "@dabb/i18n": "workspace:*",
    "@dabb/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "@shopify/react-native-skia": "*",
    "react": "*",
    "react-native": "*",
    "react-native-gesture-handler": "*",
    "react-native-reanimated": "*"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.0.18",
    "typescript": "~5.9.2",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 3: Create `packages/game-canvas/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-native",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*", "__tests__/**/*", "index.ts"]
}
```

Note: `rootDir` is omitted — `noEmit: true` makes it unused, and omitting it lets both `src/` and root `index.ts` be included without conflict.

- [ ] **Step 4: Create `packages/game-canvas/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
    },
  },
});
```

Note: coverage includes only `.ts` files (pure logic). `.tsx` component files are excluded — they are verified by typecheck and visual testing in the running app.

- [ ] **Step 5: Create empty `packages/game-canvas/index.ts`**

```ts
// Public API — populated as modules are implemented
export {};
```

- [ ] **Step 6: Install and verify**

```bash
pnpm install
pnpm list --filter @dabb/game-canvas
```

Expected: `@dabb/game-canvas 0.1.0` listed.

- [ ] **Step 7: Commit**

```bash
git add packages/game-canvas/
git commit -m "feat(game-canvas): scaffold package skeleton"
```

---

### Task 2: Arc path math

**Files:**

- Create: `packages/game-canvas/src/animations/arcPath.ts`
- Create: `packages/game-canvas/__tests__/arcPath.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/game-canvas/__tests__/arcPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arcX, arcY, interpolateArc } from '../src/animations/arcPath.js';

describe('arcX', () => {
  it('starts at 0 and ends at 1', () => {
    expect(arcX(0)).toBeCloseTo(0);
    expect(arcX(1)).toBeCloseTo(1);
  });

  it('is linear (t=0.5 → 0.5)', () => {
    expect(arcX(0.5)).toBeCloseTo(0.5);
    expect(arcX(0.25)).toBeCloseTo(0.25);
  });
});

describe('arcY', () => {
  it('starts at 0 and ends at 1', () => {
    expect(arcY(0)).toBeCloseTo(0);
    expect(arcY(1)).toBeCloseTo(1);
  });

  it('dips below 0 at midpoint (card lifts above start/end line)', () => {
    // In RN coords: lower y = visually higher. arcY(0.5) < 0 means card is above the line.
    expect(arcY(0.5)).toBeLessThan(0);
  });
});

describe('interpolateArc', () => {
  it('returns start position at t=0', () => {
    const result = interpolateArc({ x: 100, y: 200 }, { x: 400, y: 500 }, 0);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it('returns end position at t=1', () => {
    const result = interpolateArc({ x: 100, y: 200 }, { x: 400, y: 500 }, 1);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(500);
  });

  it('card is visually above straight line at t=0.5 (lower y value)', () => {
    const start = { x: 0, y: 300 };
    const end = { x: 300, y: 300 };
    const mid = interpolateArc(start, end, 0.5);
    expect(mid.y).toBeLessThan(300); // lower y = higher on screen
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: FAIL — `Cannot find module '../src/animations/arcPath.js'`

- [ ] **Step 3: Implement `src/animations/arcPath.ts`**

```ts
/**
 * Arc path math for card flight animations.
 * All functions operate on normalized time t ∈ [0, 1].
 */

/** Linear x — constant horizontal speed. */
export function arcX(t: number): number {
  return t;
}

/**
 * Y with arc lift. Quadratic bezier with control point at -0.5:
 *   B(t) = 2*(1-t)*t*(-0.5) + t^2
 * At t=0.5: B = -0.25 (card is above the straight line).
 */
export function arcY(t: number): number {
  return 2 * (1 - t) * t * -0.5 + t * t;
}

export interface Point {
  x: number;
  y: number;
}

/** Interpolates position along the arc at normalized time t. */
export function interpolateArc(from: Point, to: Point, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * arcX(t),
    y: from.y + (to.y - from.y) * arcY(t),
  };
}
```

- [ ] **Step 4: Run — verify passes**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/game-canvas/src/animations/arcPath.ts packages/game-canvas/__tests__/arcPath.test.ts
git commit -m "feat(game-canvas): add arc path math with tests"
```

---

### Task 3: Card position derivation

**Files:**

- Create: `packages/game-canvas/src/cards/cardPositions.ts`
- Create: `packages/game-canvas/__tests__/cardPositions.test.ts`

Pure derivation logic — given hand/trick card IDs and screen dimensions, return target pixel positions. Uses plain `string` IDs throughout (no `@dabb/shared-types` dependency needed here — the app layer maps typed game state to these strings).

- [ ] **Step 1: Write failing tests**

Create `packages/game-canvas/__tests__/cardPositions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveCardPositions, type LayoutDimensions } from '../src/cards/cardPositions.js';

const LAYOUT: LayoutDimensions = {
  width: 800,
  height: 600,
  playerCount: 3,
};

describe('deriveCardPositions', () => {
  it('places player hand cards in bottom third of screen', () => {
    const result = deriveCardPositions(
      {
        handCardIds: ['c1', 'c2', 'c3'],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    for (const id of ['c1', 'c2', 'c3']) {
      expect(result.playerHand[id]?.y).toBeGreaterThan(LAYOUT.height * 0.6);
    }
  });

  it('spreads hand cards horizontally left to right', () => {
    const result = deriveCardPositions(
      {
        handCardIds: ['c1', 'c2', 'c3'],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    const xs = ['c1', 'c2', 'c3'].map((id) => result.playerHand[id]?.x ?? 0);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('places trick cards near screen center', () => {
    const result = deriveCardPositions(
      {
        handCardIds: [],
        trickCardIds: [{ cardId: 't1', seatIndex: 1 }],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    const pos = result.trickCards['t1'];
    expect(pos?.x).toBeGreaterThan(LAYOUT.width * 0.3);
    expect(pos?.x).toBeLessThan(LAYOUT.width * 0.7);
    expect(pos?.y).toBeGreaterThan(LAYOUT.height * 0.2);
    expect(pos?.y).toBeLessThan(LAYOUT.height * 0.8);
  });

  it('returns a won pile position for each player ID', () => {
    const result = deriveCardPositions(
      {
        handCardIds: [],
        trickCardIds: [],
        wonPilePlayerIds: ['p0', 'p1', 'p2'],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    expect(result.wonPiles['p0']).toBeDefined();
    expect(result.wonPiles['p1']).toBeDefined();
    expect(result.wonPiles['p2']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/cards/cardPositions.ts`**

```ts
/**
 * Pure position derivation for all cards on the table.
 * Takes a snapshot of card IDs + screen dimensions, returns pixel positions.
 * No React, no side effects. Reanimated consumes the output via CardView props.
 */

export interface LayoutDimensions {
  width: number;
  height: number;
  playerCount: 3 | 4;
}

export interface CardPosition {
  x: number;
  y: number;
  rotation: number; // degrees
  zIndex: number;
}

export interface TrickCardEntry {
  cardId: string;
  seatIndex: number; // which player seat played this card
}

export interface CardPositionsInput {
  handCardIds: string[];
  trickCardIds: TrickCardEntry[];
  wonPilePlayerIds: string[]; // ordered list of player IDs (determines corner assignment)
  opponentCardCounts: Record<string, number>; // playerId → remaining card count
}

export interface CardPositionsOutput {
  playerHand: Record<string, CardPosition>;
  trickCards: Record<string, CardPosition>;
  wonPiles: Record<string, { x: number; y: number }>;
  opponentHands: Record<string, { x: number; y: number; cardCount: number }>;
}

const CARD_WIDTH = 70;
const CARD_OVERLAP = 22;
const HAND_Y_FRACTION = 0.82;
const TRICK_CENTER_X_FRACTION = 0.5;
const TRICK_CENTER_Y_FRACTION = 0.45;
const TRICK_CARD_SPREAD = 80;
const TRICK_ROTATIONS = [-4, 3, -2, 5];

/** Corner positions as [xFraction, yFraction] — index matches wonPilePlayerIds order */
const WON_PILE_CORNERS: [number, number][] = [
  [0.06, 0.9], // bottom-left  (player 0 = local player)
  [0.94, 0.06], // top-right    (opponent 1)
  [0.06, 0.06], // top-left     (opponent 2)
  [0.94, 0.9], // bottom-right (opponent 3)
];

export function deriveCardPositions(
  input: CardPositionsInput,
  layout: LayoutDimensions
): CardPositionsOutput {
  const { width, height } = layout;

  // Player hand
  const n = input.handCardIds.length;
  const handTotalWidth = n * CARD_WIDTH - Math.max(0, n - 1) * CARD_OVERLAP;
  const handStartX = (width - handTotalWidth) / 2;
  const handY = height * HAND_Y_FRACTION;
  const playerHand: Record<string, CardPosition> = {};
  input.handCardIds.forEach((id, i) => {
    playerHand[id] = {
      x: handStartX + i * (CARD_WIDTH - CARD_OVERLAP),
      y: handY,
      rotation: (i - (n - 1) / 2) * 1.8,
      zIndex: i,
    };
  });

  // Trick cards
  const tc = input.trickCardIds.length;
  const trickStartX = width * TRICK_CENTER_X_FRACTION - ((tc - 1) * TRICK_CARD_SPREAD) / 2;
  const trickCards: Record<string, CardPosition> = {};
  input.trickCardIds.forEach(({ cardId }, i) => {
    trickCards[cardId] = {
      x: trickStartX + i * TRICK_CARD_SPREAD,
      y: height * TRICK_CENTER_Y_FRACTION,
      rotation: TRICK_ROTATIONS[i % TRICK_ROTATIONS.length] ?? 0,
      zIndex: i,
    };
  });

  // Won piles (one corner per player, ordered by wonPilePlayerIds)
  const wonPiles: Record<string, { x: number; y: number }> = {};
  input.wonPilePlayerIds.forEach((playerId, i) => {
    const [fx, fy] = WON_PILE_CORNERS[i % WON_PILE_CORNERS.length]!;
    wonPiles[playerId] = { x: width * fx, y: height * fy };
  });

  // Opponent hands (evenly spaced along top edge)
  const opponentIds = Object.keys(input.opponentCardCounts);
  const opponentHands: Record<string, { x: number; y: number; cardCount: number }> = {};
  opponentIds.forEach((id, i) => {
    const fraction = (i + 1) / (opponentIds.length + 1);
    opponentHands[id] = {
      x: width * fraction,
      y: height * 0.08,
      cardCount: input.opponentCardCounts[id] ?? 0,
    };
  });

  return { playerHand, trickCards, wonPiles, opponentHands };
}
```

- [ ] **Step 4: Run — verify passes**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/game-canvas/src/cards/cardPositions.ts packages/game-canvas/__tests__/cardPositions.test.ts
git commit -m "feat(game-canvas): add card position derivation with tests"
```

---

### Task 4: Deal sequence + trick sweep timing

**Files:**

- Create: `packages/game-canvas/src/animations/dealSequence.ts`
- Create: `packages/game-canvas/src/animations/trickSweep.ts`
- Create: `packages/game-canvas/__tests__/dealSequence.test.ts`
- Create: `packages/game-canvas/__tests__/trickSweep.test.ts`

Pure timing functions only. Reanimated hook wrappers are added in Plan 2 when the app drives them.

- [ ] **Step 1: Write failing tests**

Create `packages/game-canvas/__tests__/dealSequence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeDealSchedule } from '../src/animations/dealSequence.js';

describe('computeDealSchedule', () => {
  it('first card has delay 0', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s[0]?.delay).toBe(0);
  });

  it('staggers by the given interval', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s[1]?.delay).toBe(80);
    expect(s[2]?.delay).toBe(160);
  });

  it('preserves card ID order', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s.map((e) => e.cardId)).toEqual(['c1', 'c2', 'c3']);
  });
});
```

Create `packages/game-canvas/__tests__/trickSweep.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSweepSchedule } from '../src/animations/trickSweep.js';

const DEST = { x: 50, y: 550 };

describe('computeSweepSchedule', () => {
  it('all cards go to the same destination', () => {
    const s = computeSweepSchedule(['c1', 'c2', 'c3'], DEST, 200);
    s.forEach((e) => expect(e.destination).toEqual(DEST));
  });

  it('later cards have larger delays', () => {
    const s = computeSweepSchedule(['c1', 'c2', 'c3'], DEST, 200);
    expect(s[0]!.delay).toBeLessThan(s[1]!.delay);
    expect(s[1]!.delay).toBeLessThan(s[2]!.delay);
  });

  it('gap between arrivals equals arrivalGap param', () => {
    const s = computeSweepSchedule(['c1', 'c2'], DEST, 200);
    expect(s[1]!.delay - s[0]!.delay).toBe(200);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/animations/dealSequence.ts`**

```ts
import type { Point } from './arcPath.js';

export interface DealEntry {
  cardId: string;
  delay: number; // ms before this card's animation starts
  from: Point; // source position (central deck) — passed in by the app
}

/**
 * Computes a staggered deal schedule.
 * @param cardIds   Ordered card IDs to deal
 * @param interval  ms between each card departure (default 80)
 * @param from      Screen position of the central deck (passed through, not calculated here)
 */
export function computeDealSchedule(
  cardIds: string[],
  interval: number = 80,
  from: Point = { x: 0, y: 0 }
): DealEntry[] {
  return cardIds.map((cardId, i) => ({ cardId, delay: i * interval, from }));
}
```

- [ ] **Step 4: Implement `src/animations/trickSweep.ts`**

```ts
import type { Point } from './arcPath.js';

export interface SweepEntry {
  cardId: string;
  destination: Point;
  delay: number; // ms before this card's animation starts
}

/**
 * Computes a trailing sweep schedule for trick cards moving to the winner's pile.
 * @param cardIds     All card IDs in the completed trick
 * @param destination Winner's won-pile corner position
 * @param arrivalGap  ms between each card's arrival (default 200)
 */
export function computeSweepSchedule(
  cardIds: string[],
  destination: Point,
  arrivalGap: number = 200
): SweepEntry[] {
  return cardIds.map((cardId, i) => ({ cardId, destination, delay: i * arrivalGap }));
}
```

- [ ] **Step 5: Run — verify all tests pass**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/game-canvas/src/animations/dealSequence.ts packages/game-canvas/src/animations/trickSweep.ts packages/game-canvas/__tests__/dealSequence.test.ts packages/game-canvas/__tests__/trickSweep.test.ts
git commit -m "feat(game-canvas): add deal sequence and trick sweep timing"
```

---

## Chunk 2: Skia Table + Card Components

### Task 5: Skia shader definitions

**Files:**

- Create: `packages/game-canvas/src/table/shaders.ts`

- [ ] **Step 1: Create `src/table/shaders.ts`**

```ts
/**
 * Skia RuntimeEffect shader source strings.
 * Compiled at runtime via Skia.RuntimeEffect.Make(source).
 * Verify visually in the running app — no unit tests for shader output.
 */

/** Felt fabric noise shader. Uniforms: vec2 iResolution */
export const FELT_SHADER_SOURCE = `
uniform vec2 iResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

half4 main(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution;
  vec3 feltGreen = vec3(0.176, 0.353, 0.149);
  float n = noise(fragCoord * 0.08) + noise(fragCoord * 0.2) * 0.4;
  n /= 1.4;
  vec2 c = uv - 0.5;
  float vignette = clamp(1.0 - dot(c, c) * 1.2, 0.0, 1.0);
  vec3 color = feltGreen * (0.88 + n * 0.12) * vignette;
  return half4(color, 1.0);
}
`;

/** Wood grain shader. Uniforms: vec2 iResolution */
export const WOOD_SHADER_SOURCE = `
uniform vec2 iResolution;

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise1d(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

half4 main(vec2 fragCoord) {
  float warp = noise1d(fragCoord.y * 0.02) * 20.0;
  float grain = noise1d((fragCoord.y + warp) * 0.15) + noise1d((fragCoord.y + warp) * 0.4) * 0.4;
  grain /= 1.4;
  vec3 woodBase = vec3(0.60, 0.36, 0.18);
  vec3 woodDark = vec3(0.38, 0.20, 0.08);
  vec3 color = mix(woodDark, woodBase, grain);
  vec2 uv = fragCoord / iResolution;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  color *= (0.75 + smoothstep(0.0, 0.12, edge) * 0.25);
  return half4(color, 1.0);
}
`;
```

- [ ] **Step 2: Commit**

```bash
git add packages/game-canvas/src/table/shaders.ts
git commit -m "feat(game-canvas): add Skia felt and wood grain shaders"
```

---

### Task 6: GameTable + useSkiaEffects

**Files:**

- Create: `packages/game-canvas/src/table/useSkiaEffects.ts`
- Create: `packages/game-canvas/src/table/GameTable.tsx`

`useSkiaEffects` owns shared values. `GameTable` reads them to render dynamic effects. The two are always used together — the app calls `useSkiaEffects()`, passes effects to `<GameTable effects={...} />`, and triggers effects via the returned functions.

- [ ] **Step 1: Create `src/table/useSkiaEffects.ts`**

```ts
import { useSharedValue } from 'react-native-reanimated';

export interface ShadowState {
  x: number;
  y: number;
  elevation: number;
}
export interface RippleState {
  x: number;
  y: number;
  progress: number;
}
export interface ParticleState {
  x: number;
  y: number;
  active: boolean;
}

export function useSkiaEffects() {
  const shadow = useSharedValue<ShadowState>({ x: 0, y: 0, elevation: 0 });
  const ripple = useSharedValue<RippleState>({ x: 0, y: 0, progress: 0 });
  const particle = useSharedValue<ParticleState>({ x: 0, y: 0, active: false });

  function triggerCardShadow(x: number, y: number, elevation: number) {
    'worklet';
    shadow.value = { x, y, elevation };
  }

  function clearCardShadow() {
    'worklet';
    shadow.value = { x: 0, y: 0, elevation: 0 };
  }

  function triggerFeltRipple(x: number, y: number) {
    'worklet';
    ripple.value = { x, y, progress: 0 };
  }

  function triggerSweepParticles(x: number, y: number) {
    'worklet';
    particle.value = { x, y, active: true };
  }

  return {
    shadow,
    ripple,
    particle,
    triggerCardShadow,
    clearCardShadow,
    triggerFeltRipple,
    triggerSweepParticles,
  };
}

export type SkiaEffects = ReturnType<typeof useSkiaEffects>;
```

- [ ] **Step 2: Create `src/table/GameTable.tsx`**

```tsx
/**
 * GameTable
 *
 * Full-bleed Skia <Canvas> rendering:
 * - Static: wood surround, felt surface, trick zone border
 * - Dynamic (via effects prop): card shadow, felt ripple, sweep particles
 *
 * Usage:
 *   const effects = useSkiaEffects();
 *   <GameTable width={w} height={h} effects={effects} />
 *   // Call effects.triggerFeltRipple(x, y) etc. from card event handlers
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Path, Skia, Circle, rect, rrect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { FELT_SHADER_SOURCE, WOOD_SHADER_SOURCE } from './shaders.js';
import type { SkiaEffects } from './useSkiaEffects.js';

export interface GameTableProps {
  width: number;
  height: number;
  effects: SkiaEffects;
  surroundFraction?: number;
}

export function GameTable({ width, height, effects, surroundFraction = 0.05 }: GameTableProps) {
  const surround = Math.round(width * surroundFraction);
  const feltW = width - surround * 2;
  const feltH = height - surround * 2;

  // Compile shaders once
  const feltEffect = useMemo(() => Skia.RuntimeEffect.Make(FELT_SHADER_SOURCE)!, []);
  const woodEffect = useMemo(() => Skia.RuntimeEffect.Make(WOOD_SHADER_SOURCE)!, []);

  const feltUniforms = useMemo(() => ({ iResolution: [feltW, feltH] }), [feltW, feltH]);
  const woodUniforms = useMemo(() => ({ iResolution: [width, height] }), [width, height]);

  // Trick zone oval
  const trickPath = useMemo(() => {
    const path = Skia.Path.Make();
    const cx = width / 2;
    const cy = height / 2;
    path.addOval(Skia.XYWHRect(cx - width * 0.22, cy - height * 0.18, width * 0.44, height * 0.36));
    return path;
  }, [width, height]);

  // Shadow circle driven by shared value
  const shadowOpacity = useDerivedValue(() => effects.shadow.value.elevation * 0.4);
  const shadowRadius = useDerivedValue(() => 20 + effects.shadow.value.elevation * 30);
  const shadowX = useDerivedValue(() => effects.shadow.value.x);
  const shadowY = useDerivedValue(() => effects.shadow.value.y);

  // Ripple circle driven by shared value
  const rippleOpacity = useDerivedValue(() => (1 - effects.ripple.value.progress) * 0.25);
  const rippleRadius = useDerivedValue(() => effects.ripple.value.progress * 60);
  const rippleX = useDerivedValue(() => effects.ripple.value.x);
  const rippleY = useDerivedValue(() => effects.ripple.value.y);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {/* Wood surround */}
      <Fill>
        <skia.Shader effect={woodEffect} uniforms={woodUniforms} />
      </Fill>

      {/* Felt surface */}
      <Fill clip={rrect(rect(surround, surround, feltW, feltH), 8, 8)}>
        <skia.Shader effect={feltEffect} uniforms={feltUniforms} />
      </Fill>

      {/* Trick zone border */}
      <Path path={trickPath} color="rgba(255,255,255,0.10)" style="stroke" strokeWidth={1.5} />

      {/* Flying card shadow */}
      <Circle
        cx={shadowX}
        cy={shadowY}
        r={shadowRadius}
        color="rgba(0,0,0,1)"
        opacity={shadowOpacity}
      />

      {/* Felt ripple on card land */}
      <Circle
        cx={rippleX}
        cy={rippleY}
        r={rippleRadius}
        color="rgba(255,255,255,1)"
        style="stroke"
        strokeWidth={1.5}
        opacity={rippleOpacity}
      />
    </Canvas>
  );
}
```

Note: `<skia.Shader>` is the correct Skia API for applying a compiled RuntimeEffect as a shader paint child. If the Skia version installed uses a different component name (e.g. `<RuntimeShader>`), check the installed version's docs and adjust accordingly — the compiled `effect` object (not the raw string) is always passed.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dabb/game-canvas typecheck
```

Expected: passes. Fix any Skia API naming issues by consulting `node_modules/@shopify/react-native-skia/src/index.ts` exports.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/table/
git commit -m "feat(game-canvas): add GameTable Skia canvas with dynamic effects"
```

---

### Task 7: Card face and back components

**Files:**

- Create: `packages/game-canvas/src/cards/CardFace.tsx`
- Create: `packages/game-canvas/src/cards/CardBack.tsx`

Face card illustrations (König/Ober/Buabe SVGs) currently live in `apps/mobile/src/components/game/CardFaces/` and `apps/web/src/components/game/CardFaces/`. **They are NOT imported here.** Emoji placeholders are used in this plan. Plan 2 moves the illustrations to `packages/card-assets` and wires them into `CardFace`.

- [ ] **Step 1: Create `src/cards/CardFace.tsx`**

```tsx
/**
 * CardFace — antique paper card face.
 * König/Ober/Buabe use emoji placeholders; wired to real SVGs in Plan 2.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SUIT_SYMBOLS, getSuitColor } from '@dabb/card-assets';
import type { Card } from '@dabb/shared-types';

export interface CardFaceProps {
  card: Card;
  width: number;
  height: number;
}

const RANK_ABBR: Record<string, string> = { König: 'K', Ober: 'O', Buabe: 'B' };
const FACE_EMOJI: Record<string, string> = { König: '♛', Ober: '♜', Buabe: '♞' };

export function CardFace({ card, width, height }: CardFaceProps) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const color = getSuitColor(card.suit);
  const abbr = RANK_ABBR[card.rank] ?? card.rank;
  const isFace = card.rank in FACE_EMOJI;
  const cornerSz = Math.round(width * 0.17);
  const centerSz = Math.round(width * 0.42);

  return (
    <View style={[styles.card, { width, height, borderRadius: width * 0.06 }]}>
      <View style={styles.cornerTL}>
        <Text style={[styles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>{symbol}</Text>
      </View>
      <View style={styles.center}>
        {isFace ? (
          <Text style={{ fontSize: centerSz * 0.7 }}>{FACE_EMOJI[card.rank]}</Text>
        ) : (
          <Text style={[styles.centerSuit, { fontSize: centerSz, color }]}>{symbol}</Text>
        )}
      </View>
      <View style={[styles.cornerTL, styles.cornerBR, { transform: [{ rotate: '180deg' }] }]}>
        <Text style={[styles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>{symbol}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f2e8d0',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#c8b89a',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  cornerTL: { position: 'absolute', top: 4, left: 5, alignItems: 'center' },
  cornerBR: { top: undefined, left: undefined, bottom: 4, right: 5 },
  cornerRank: { fontFamily: 'IMFellEnglishSC_400Regular', fontWeight: '700', lineHeight: 15 },
  cornerSuit: { lineHeight: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSuit: { fontFamily: 'IMFellEnglishSC_400Regular' },
});
```

- [ ] **Step 2: Create `src/cards/CardBack.tsx`**

```tsx
/**
 * CardBack — dark brown card back with cached Skia diagonal hatching.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Skia, Picture } from '@shopify/react-native-skia';

export interface CardBackProps {
  width: number;
  height: number;
}

export function CardBack({ width, height }: CardBackProps) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const cvs = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    const bg = Skia.Paint();
    bg.setColor(Skia.Color('#5c2e0a'));
    cvs.drawRect(Skia.XYWHRect(0, 0, width, height), bg);

    const line = Skia.Paint();
    line.setColor(Skia.Color('rgba(255,255,255,0.08)'));
    line.setStrokeWidth(1);
    const step = 6;
    for (let i = -height; i < width + height; i += step) {
      cvs.drawLine(i, 0, i + height, height, line);
      cvs.drawLine(i, height, i + height, 0, line);
    }

    const border = Skia.Paint();
    border.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    border.setStyle(1);
    border.setStrokeWidth(1);
    cvs.drawRect(Skia.XYWHRect(3, 3, width - 6, height - 6), border);

    return recorder.finishRecordingAsPicture();
  }, [width, height]);

  return (
    <View style={[styles.card, { width, height, borderRadius: width * 0.06 }]}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dabb/game-canvas typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/cards/CardFace.tsx packages/game-canvas/src/cards/CardBack.tsx
git commit -m "feat(game-canvas): add antique paper CardFace and Skia CardBack"
```

---

### Task 8: CardView with tap + drag gestures

**Files:**

- Create: `packages/game-canvas/src/cards/dragGesture.ts`
- Create: `packages/game-canvas/src/cards/CardView.tsx`

Both tap and drag use RNGH gestures composed with `Gesture.Exclusive` so they don't conflict with the native responder system.

- [ ] **Step 1: Create `src/cards/dragGesture.ts`**

```ts
import { Gesture } from 'react-native-gesture-handler';
import { withSpring, runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

export interface CardGestureOptions {
  draggable: boolean;
  onTap?: () => void;
  onDrop?: (x: number, y: number) => void;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}

export function createCardGesture(opts: CardGestureOptions) {
  const tap = Gesture.Tap()
    .enabled(!!opts.onTap)
    .onEnd(() => {
      'worklet';
      if (opts.onTap) runOnJS(opts.onTap)();
    });

  const pan = Gesture.Pan()
    .enabled(opts.draggable)
    .activeOffsetY(-8)
    .failOffsetX([-20, 20])
    .onStart(() => {
      'worklet';
      opts.scale.value = withSpring(1.08, { damping: 15, stiffness: 300 });
    })
    .onUpdate((e) => {
      'worklet';
      opts.translateX.value = e.translationX;
      opts.translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      opts.translateX.value = withSpring(0, { damping: 20, stiffness: 400 });
      opts.translateY.value = withSpring(0, { damping: 20, stiffness: 400 });
      opts.scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      if (opts.onDrop) runOnJS(opts.onDrop)(e.absoluteX, e.absoluteY);
    });

  // Exclusive: pan takes priority; tap fires only when pan doesn't activate
  return Gesture.Exclusive(pan, tap);
}
```

- [ ] **Step 2: Create `src/cards/CardView.tsx`**

```tsx
/**
 * CardView — animated card on the table.
 * Moves to target position via Reanimated withTiming.
 * Supports tap-to-play and drag-to-play via RNGH gestures.
 */
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { Card } from '@dabb/shared-types';
import { CardFace } from './CardFace.js';
import { CardBack } from './CardBack.js';
import { createCardGesture } from './dragGesture.js';

export interface CardViewProps {
  card: Card | null; // null = show back
  targetX: number;
  targetY: number;
  targetRotation: number; // degrees
  zIndex: number;
  width?: number;
  height?: number;
  draggable?: boolean;
  onTap?: () => void;
  onDrop?: (x: number, y: number) => void;
  animationDuration?: number;
}

const DEFAULT_W = 70;
const DEFAULT_H = 105;

export function CardView({
  card,
  targetX,
  targetY,
  targetRotation,
  zIndex,
  width = DEFAULT_W,
  height = DEFAULT_H,
  draggable = false,
  onTap,
  onDrop,
  animationDuration = 400,
}: CardViewProps) {
  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);
  const rotation = useSharedValue(targetRotation);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: animationDuration, easing: Easing.out(Easing.cubic) };
    x.value = withTiming(targetX, cfg);
    y.value = withTiming(targetY, cfg);
    rotation.value = withTiming(targetRotation, { duration: animationDuration });
  }, [targetX, targetY, targetRotation, animationDuration]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + translateX.value,
    top: y.value + translateY.value,
    zIndex,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  const gesture = createCardGesture({ draggable, onTap, onDrop, translateX, translateY, scale });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        {card !== null ? (
          <CardFace card={card} width={width} height={height} />
        ) : (
          <CardBack width={width} height={height} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dabb/game-canvas typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/cards/dragGesture.ts packages/game-canvas/src/cards/CardView.tsx
git commit -m "feat(game-canvas): add CardView with tap+drag gesture composition"
```

---

## Chunk 3: Phase Overlays + Public API

### Task 9: Phase overlay components

**Files:**

- Create: `packages/game-canvas/src/overlays/PhaseOverlay.tsx`
- Create: `packages/game-canvas/src/overlays/BiddingOverlay.tsx`
- Create: `packages/game-canvas/src/overlays/DabbOverlay.tsx`
- Create: `packages/game-canvas/src/overlays/TrumpOverlay.tsx`
- Create: `packages/game-canvas/src/overlays/MeldingOverlay.tsx`

- [ ] **Step 1: Create `src/overlays/PhaseOverlay.tsx`**

```tsx
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface PhaseOverlayProps {
  visible: boolean;
  rotation?: number;
  children: React.ReactNode;
}

export function PhaseOverlay({ visible, rotation = -2, children }: PhaseOverlayProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 250 });
      scale.value = withSpring(1, { damping: 18, stiffness: 250 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(-20, { duration: 150 });
      scale.value = withTiming(0.95, { duration: 150 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.overlay, style]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.paper}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', alignSelf: 'center', top: '28%', zIndex: 100 },
  paper: {
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    paddingHorizontal: 24,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 240,
  },
});
```

- [ ] **Step 2: Create `src/overlays/BiddingOverlay.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from '@dabb/i18n';

const BID_AMOUNTS = [150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 300];

export interface BiddingOverlayProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

export function BiddingOverlay({ currentBid, isMyTurn, onBid, onPass }: BiddingOverlayProps) {
  const { t } = useTranslation();
  const validBids = BID_AMOUNTS.filter((b) => b > currentBid);

  return (
    <View style={styles.container}>
      <Text style={styles.currentBid}>
        {t('bidding.currentBid')}: {currentBid}
      </Text>
      {isMyTurn ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.bidRow}>
              {validBids.map((amount) => (
                <TouchableOpacity key={amount} style={styles.chip} onPress={() => onBid(amount)}>
                  <Text style={styles.chipText}>{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.passButton} onPress={onPass}>
            <Text style={styles.passText}>{t('bidding.pass')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.waiting}>{t('bidding.waiting')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  currentBid: { fontFamily: 'Caveat_700Bold', fontSize: 22, color: '#3d2e18' },
  bidRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: '#8a5e2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  chipText: { fontFamily: 'Caveat_700Bold', fontSize: 17, color: '#f2e8d0' },
  passButton: {
    borderWidth: 1.5,
    borderColor: '#8a5e2e',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  passText: { fontFamily: 'Caveat_400Regular', fontSize: 16, color: '#8a5e2e' },
  waiting: { fontFamily: 'Caveat_400Regular', fontSize: 16, color: '#8a7a60' },
});
```

- [ ] **Step 3: Create `src/overlays/DabbOverlay.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import type { Card, Suit } from '@dabb/shared-types';
import { CardFace } from '../cards/CardFace.js';
import { CardBack } from '../cards/CardBack.js';
import { SUIT_SYMBOLS } from '@dabb/card-assets';

const CARD_W = 60;
const CARD_H = 90;
const SUITS: Suit[] = ['Kreuz', 'Schippe', 'Herz', 'Bollen'];

export type DabbStep = 'take' | 'discard';

export interface DabbOverlayProps {
  step: DabbStep;
  dabbCards: Card[];
  selectedCardIds: string[];
  onTake: () => void;
  onToggleCard: (cardId: string) => void;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

export function DabbOverlay({
  step,
  dabbCards,
  selectedCardIds,
  onTake,
  onToggleCard,
  onDiscard,
  onGoOut,
}: DabbOverlayProps) {
  const { t } = useTranslation();

  if (step === 'take') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('dabb.takeDabb')}</Text>
        <View style={styles.cardRow}>
          <CardBack width={CARD_W} height={CARD_H} />
          <CardBack width={CARD_W} height={CARD_H} />
        </View>
        <TouchableOpacity style={styles.primary} onPress={onTake}>
          <Text style={styles.primaryText}>{t('dabb.take')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('dabb.selectDiscard')}</Text>
      <View style={styles.cardRow}>
        {dabbCards.map((card) => (
          <TouchableOpacity
            key={card.id}
            onPress={() => onToggleCard(card.id)}
            style={[styles.cardWrap, selectedCardIds.includes(card.id) && styles.cardSelected]}
          >
            <CardFace card={card} width={CARD_W} height={CARD_H} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.primary, selectedCardIds.length !== 2 && styles.disabled]}
        onPress={onDiscard}
        disabled={selectedCardIds.length !== 2}
      >
        <Text style={styles.primaryText}>{t('dabb.discard')}</Text>
      </TouchableOpacity>
      <Text style={styles.or}>{t('dabb.or')}</Text>
      <Text style={styles.goOutLabel}>{t('dabb.goOut')}</Text>
      <View style={styles.suitRow}>
        {SUITS.map((suit) => (
          <TouchableOpacity key={suit} style={styles.suitToken} onPress={() => onGoOut(suit)}>
            <Text style={styles.suitSymbol}>{SUIT_SYMBOLS[suit]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  title: { fontFamily: 'Caveat_700Bold', fontSize: 20, color: '#3d2e18' },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardWrap: { borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: '#d4890a' },
  primary: {
    backgroundColor: '#8a5e2e',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  primaryText: { fontFamily: 'Caveat_700Bold', fontSize: 17, color: '#f2e8d0' },
  disabled: { opacity: 0.4 },
  or: { fontFamily: 'Caveat_400Regular', fontSize: 14, color: '#8a7a60' },
  goOutLabel: { fontFamily: 'Caveat_400Regular', fontSize: 15, color: '#3d2e18' },
  suitRow: { flexDirection: 'row', gap: 10 },
  suitToken: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8a5e2e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  suitSymbol: { fontSize: 22 },
});
```

- [ ] **Step 4: Create `src/overlays/TrumpOverlay.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import type { Suit } from '@dabb/shared-types';
import { SUIT_SYMBOLS, getSuitColor } from '@dabb/card-assets';

const SUITS: Suit[] = ['Kreuz', 'Schippe', 'Herz', 'Bollen'];

export interface TrumpOverlayProps {
  onSelectTrump: (suit: Suit) => void;
}

export function TrumpOverlay({ onSelectTrump }: TrumpOverlayProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('trump.selectTrump')}</Text>
      <View style={styles.row}>
        {SUITS.map((suit) => (
          <TouchableOpacity
            key={suit}
            style={[styles.coin, { backgroundColor: getSuitColor(suit) }]}
            onPress={() => onSelectTrump(suit)}
          >
            <Text style={styles.symbol}>{SUIT_SYMBOLS[suit]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontFamily: 'Caveat_700Bold', fontSize: 20, color: '#3d2e18' },
  row: { flexDirection: 'row', gap: 14 },
  coin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  symbol: { fontSize: 28, color: '#fff' },
});
```

- [ ] **Step 5: Create `src/overlays/MeldingOverlay.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface MeldEntry {
  name: string;
  points: number;
}

export interface MeldingOverlayProps {
  melds: MeldEntry[];
  totalPoints: number;
  canConfirm: boolean;
  onConfirm: () => void;
}

export function MeldingOverlay({ melds, totalPoints, canConfirm, onConfirm }: MeldingOverlayProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('melding.yourMelds')}</Text>
      <ScrollView style={styles.list}>
        {melds.map((m, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.pts}>+{m.points}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('melding.total')}</Text>
        <Text style={styles.totalPts}>{totalPoints}</Text>
      </View>
      {canConfirm && (
        <TouchableOpacity style={styles.confirm} onPress={onConfirm}>
          <Text style={styles.confirmText}>{t('melding.confirm')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10, minWidth: 220 },
  title: { fontFamily: 'Caveat_700Bold', fontSize: 20, color: '#3d2e18' },
  list: { maxHeight: 160, width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: '#c8b090',
  },
  name: { fontFamily: 'Caveat_400Regular', fontSize: 16, color: '#3d2e18' },
  pts: { fontFamily: 'Caveat_700Bold', fontSize: 16, color: '#3a7d44' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingTop: 4 },
  totalLabel: { fontFamily: 'Caveat_700Bold', fontSize: 17, color: '#3d2e18' },
  totalPts: { fontFamily: 'Caveat_700Bold', fontSize: 17, color: '#3a7d44' },
  confirm: {
    backgroundColor: '#3a7d44',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 8,
    marginTop: 4,
  },
  confirmText: { fontFamily: 'Caveat_700Bold', fontSize: 17, color: '#f2e8d0' },
});
```

- [ ] **Step 6: Typecheck all overlays**

```bash
pnpm --filter @dabb/game-canvas typecheck
```

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add packages/game-canvas/src/overlays/
git commit -m "feat(game-canvas): add phase overlay components"
```

---

### Task 10: Wire public API

**Files:**

- Modify: `packages/game-canvas/index.ts`

Note: The public API exports more than the minimal set listed in the spec — all overlay content components are exported so `apps/client` can compose them without importing internals. This is an intentional expansion acknowledged here.

- [ ] **Step 1: Replace `index.ts` with final public API**

```ts
// Table
export { GameTable } from './src/table/GameTable.js';
export type { GameTableProps } from './src/table/GameTable.js';
export { useSkiaEffects } from './src/table/useSkiaEffects.js';
export type {
  SkiaEffects,
  ShadowState,
  RippleState,
  ParticleState,
} from './src/table/useSkiaEffects.js';

// Cards
export { CardView } from './src/cards/CardView.js';
export type { CardViewProps } from './src/cards/CardView.js';
export { deriveCardPositions } from './src/cards/cardPositions.js';
export type {
  CardPositionsInput,
  CardPositionsOutput,
  CardPosition,
  LayoutDimensions,
} from './src/cards/cardPositions.js';

// Animations
export { interpolateArc } from './src/animations/arcPath.js';
export type { Point } from './src/animations/arcPath.js';
export { computeDealSchedule } from './src/animations/dealSequence.js';
export type { DealEntry } from './src/animations/dealSequence.js';
export { computeSweepSchedule } from './src/animations/trickSweep.js';
export type { SweepEntry } from './src/animations/trickSweep.js';

// Overlays
export { PhaseOverlay } from './src/overlays/PhaseOverlay.js';
export type { PhaseOverlayProps } from './src/overlays/PhaseOverlay.js';
export { BiddingOverlay } from './src/overlays/BiddingOverlay.js';
export type { BiddingOverlayProps } from './src/overlays/BiddingOverlay.js';
export { DabbOverlay } from './src/overlays/DabbOverlay.js';
export type { DabbOverlayProps, DabbStep } from './src/overlays/DabbOverlay.js';
export { TrumpOverlay } from './src/overlays/TrumpOverlay.js';
export type { TrumpOverlayProps } from './src/overlays/TrumpOverlay.js';
export { MeldingOverlay } from './src/overlays/MeldingOverlay.js';
export type { MeldingOverlayProps, MeldEntry } from './src/overlays/MeldingOverlay.js';
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @dabb/game-canvas test
```

Expected: all tests pass.

- [ ] **Step 3: Final typecheck**

```bash
pnpm --filter @dabb/game-canvas typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/index.ts
git commit -m "feat(game-canvas): finalize public API exports"
```

---

**Plan 1 complete.** `packages/game-canvas` is built, tested, and ready.
Next: `docs/superpowers/plans/2026-03-13-client-app.md` (Plan 2).
