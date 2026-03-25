# Dabb Card Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Highlight cards that came from the dabb with a golden border, visible from after dabb pickup through the melding phase.

**Architecture:** Add a `highlighted` prop to `CardView` (renders a gold absolute-positioned border overlay). Extract a pure helper `computeHighlightedDabbIds` into `PlayerHand` and pass `highlighted` to `CardView` in both render branches. No state changes needed — `GameState.dabbCardIds` already tracks the right card IDs.

**Tech Stack:** React Native, TypeScript, Vitest

---

## File Map

| File                                                           | Change                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/game-canvas/src/cards/CardView.tsx`                  | Add `highlighted?: boolean` prop + render gold border overlay                              |
| `apps/client/src/components/game/PlayerHand.tsx`               | Extract `computeHighlightedDabbIds` helper; pass `highlighted` in both `CardView` branches |
| `apps/client/src/components/game/__tests__/PlayerHand.test.ts` | New — unit tests for `computeHighlightedDabbIds`                                           |

---

## Task 1: Add `highlighted` prop to `CardView`

**Files:**

- Modify: `packages/game-canvas/src/cards/CardView.tsx`

- [ ] **Step 1: Add `highlighted` to `CardViewProps` interface**

In `packages/game-canvas/src/cards/CardView.tsx`, add the new prop to the interface (after `dimmed`):

```ts
dimmed?: boolean;
selected?: boolean;
highlighted?: boolean;
```

- [ ] **Step 2: Destructure `highlighted` with default in the function signature**

```ts
dimmed = false,
selected = false,
highlighted = false,
```

- [ ] **Step 3: Render the gold border overlay**

Add the `highlighted` overlay after the `selected` overlay block (around line 189), still inside `<AnimatedView>`:

```tsx
{
  highlighted && (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        borderRadius: width * 0.06,
        borderWidth: 2,
        borderColor: '#ffd700',
      }}
      pointerEvents="none"
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/game-canvas/src/cards/CardView.tsx
git commit -m "feat(game-canvas): add highlighted prop to CardView"
```

---

## Task 2: Extract helper + write unit tests (TDD)

**Files:**

- Modify: `apps/client/src/components/game/PlayerHand.tsx`
- Create: `apps/client/src/components/game/__tests__/PlayerHand.test.ts`

- [ ] **Step 1: Create the test file with failing tests**

Create `apps/client/src/components/game/__tests__/PlayerHand.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeHighlightedDabbIds } from '../PlayerHand.js';
import type { GamePhase } from '@dabb/shared-types';

describe('computeHighlightedDabbIds', () => {
  const ids = ['kreuz-ass-0', 'herz-koenig-1'];

  it('highlights in dabb phase with cards', () => {
    const result = computeHighlightedDabbIds('dabb', ids);
    expect(result.has('kreuz-ass-0')).toBe(true);
    expect(result.has('herz-koenig-1')).toBe(true);
  });

  it('highlights in trump phase', () => {
    const result = computeHighlightedDabbIds('trump', ids);
    expect(result.size).toBe(2);
  });

  it('highlights in melding phase', () => {
    const result = computeHighlightedDabbIds('melding', ids);
    expect(result.size).toBe(2);
  });

  it('no highlight in dabb phase when dabbCardIds is empty (take step)', () => {
    const result = computeHighlightedDabbIds('dabb', []);
    expect(result.size).toBe(0);
  });

  it('no highlight in tricks phase even with dabbCardIds populated', () => {
    const result = computeHighlightedDabbIds('tricks', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in bidding phase', () => {
    const result = computeHighlightedDabbIds('bidding', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in finished phase', () => {
    const result = computeHighlightedDabbIds('finished', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in scoring phase', () => {
    const result = computeHighlightedDabbIds('scoring', ids);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
pnpm --filter @dabb/client test --run
```

Expected: FAIL — `computeHighlightedDabbIds` not exported from `PlayerHand.js`

- [ ] **Step 3: Extract and export `computeHighlightedDabbIds` in `PlayerHand.tsx`**

Add this exported pure function near the top of `PlayerHand.tsx`, after imports:

```ts
import type { GamePhase } from '@dabb/shared-types';

export function computeHighlightedDabbIds(phase: GamePhase, dabbCardIds: string[]): Set<string> {
  const active =
    (phase === 'dabb' || phase === 'trump' || phase === 'melding') && dabbCardIds.length > 0;
  return active ? new Set(dabbCardIds) : new Set<string>();
}
```

Note: `GamePhase` is exported from `@dabb/shared-types` (re-exported via `packages/shared-types/src/index.ts`).

- [ ] **Step 4: Run the tests — verify they pass**

```bash
pnpm --filter @dabb/client test --run
```

Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/PlayerHand.tsx apps/client/src/components/game/__tests__/PlayerHand.test.ts
git commit -m "feat(client): extract computeHighlightedDabbIds with unit tests"
```

---

## Task 3: Wire `highlighted` into both `CardView` render branches

**Files:**

- Modify: `apps/client/src/components/game/PlayerHand.tsx`

- [ ] **Step 1: Compute `highlightedIds` in the render body**

In `PlayerHand`, after the existing `validIds` computation, add:

```ts
const highlightedIds = computeHighlightedDabbIds(gameState.phase, gameState.dabbCardIds);
```

- [ ] **Step 2: Pass `highlighted` in the discard-mode branch**

The discard-mode branch currently renders:

```tsx
<CardView
  key={card.id}
  card={card.id}
  targetX={pos.x}
  targetY={isSelected ? pos.y - 20 : pos.y}
  targetRotation={pos.rotation}
  zIndex={isSelected ? pos.zIndex + 100 : pos.zIndex}
  selected={isSelected}
  onTap={() => { ... }}
/>
```

Add `highlighted={highlightedIds.has(card.id)}` to this `CardView`.

- [ ] **Step 3: Pass `highlighted` in the normal-play branch**

The normal-play branch renders a `CardView` with `dimmed`, `draggable`, `effects`, `onTap`, `onDrop`. Add `highlighted={highlightedIds.has(card.id)}` to this `CardView`.

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
pnpm --filter @dabb/client test --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/PlayerHand.tsx
git commit -m "feat(client): highlight dabb-origin cards in hand until tricks phase"
```

---

## Task 4: CI verification

- [ ] **Step 1: Run full CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm run typecheck
```

All must pass. Fix any issues before proceeding.

- [ ] **Step 2: Manual smoke test (optional but recommended)**

Start a dev game, take the dabb as bid winner, and confirm:

- Gold border appears on dabb cards in hand during discard, trump, and melding phases
- Gold border disappears when tricks phase starts
- Selecting a dabb card for discard shows both gold (highlighted) and orange (selected) borders simultaneously
