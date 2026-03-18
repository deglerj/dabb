# Wire Dead Code & Fix Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up six pre-built but unused hooks/utilities, fix the roundScores reducer bug so the scoreboard strip works, and remove the remaining dead exports.

**Architecture:** Each fix is self-contained and committed separately. The reducer fix is first because the scoreboard modal depends on `state.roundScores` being populated. Celebration, version check, turn notification, and sounds are independent wiring tasks. Dead code removal is last to ensure nothing currently unused becomes used during this work.

**Tech Stack:** TypeScript, React Native, Expo, @shopify/react-native-skia v2, react-native-reanimated v4, Vitest

---

## Chunk 1: Reducer Fix, Scoreboard Modal, and Dead Code Removal

### Task 1: Fix `handleRoundScored` reducer + regression test

**Files:**

- Modify: `packages/game-logic/src/state/reducer.ts` (lines 383–399)
- Create: `packages/game-logic/src/__tests__/roundScores.test.ts`

- [ ] **Step 1: Write the failing regression test**

Create `packages/game-logic/src/__tests__/roundScores.test.ts`:

```typescript
/**
 * Regression test: handleRoundScored was silently dropping roundScores,
 * leaving state.roundScores as an empty Map after a ROUND_SCORED event.
 */
import { describe, it, expect } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';
import { applyEvents } from '../state/reducer.js';
import { createRoundScoredEvent } from '../events/generators.js';

describe('ROUND_SCORED reducer (regression)', () => {
  it('populates roundScores from event payload (regression)', () => {
    const ctx = { sessionId: 'test', sequence: 1 };
    const scores = {
      [0 as PlayerIndex]: { melds: 80, tricks: 120, total: 200, bidMet: true },
      [1 as PlayerIndex]: { melds: 40, tricks: 60, total: 100, bidMet: false },
    } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>;
    const totalScores = {
      [0 as PlayerIndex]: 200,
      [1 as PlayerIndex]: 100,
    } as Record<PlayerIndex, number>;

    const event = createRoundScoredEvent(ctx, scores, totalScores);
    const state = applyEvents([event]);

    expect(state.roundScores.size).toBe(2);
    expect(state.roundScores.get(0 as PlayerIndex)).toEqual({ melds: 80, tricks: 120, total: 200 });
    expect(state.roundScores.get(1 as PlayerIndex)).toEqual({ melds: 40, tricks: 60, total: 100 });
    // bidMet is stripped — RoundScore type does not include it
    expect(state.roundScores.get(0 as PlayerIndex)).not.toHaveProperty('bidMet');
  });

  it('resets roundScores between rounds (regression)', () => {
    const ctx1 = { sessionId: 'test', sequence: 1 };
    const ctx2 = { sessionId: 'test', sequence: 2 };
    const scores = {
      [0 as PlayerIndex]: { melds: 80, tricks: 120, total: 200, bidMet: true },
      [1 as PlayerIndex]: { melds: 40, tricks: 60, total: 100, bidMet: false },
    } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>;
    const totalScores = { [0 as PlayerIndex]: 200, [1 as PlayerIndex]: 100 } as Record<
      PlayerIndex,
      number
    >;

    const round1Event = createRoundScoredEvent(ctx1, scores, totalScores);
    const round2Event = createRoundScoredEvent(
      ctx2,
      {
        [0 as PlayerIndex]: { melds: 0, tricks: 0, total: 0, bidMet: false },
        [1 as PlayerIndex]: { melds: 0, tricks: 0, total: 0, bidMet: false },
      } as Record<PlayerIndex, { melds: number; tricks: number; total: number; bidMet: boolean }>,
      totalScores
    );

    const state = applyEvents([round1Event, round2Event]);

    // Second ROUND_SCORED overwrites, not accumulates
    expect(state.roundScores.get(0 as PlayerIndex)).toEqual({ melds: 0, tricks: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @dabb/game-logic test roundScores
```

Expected: FAIL — `state.roundScores.size` is 0, not 2.

- [ ] **Step 3: Fix `handleRoundScored` in the reducer**

In `packages/game-logic/src/state/reducer.ts`, replace lines 383–399:

```typescript
function handleRoundScored(
  state: GameState,
  event: Extract<GameEvent, { type: 'ROUND_SCORED' }>
): GameState {
  const totalScores = new Map(state.totalScores);
  const roundScores = new Map<PlayerIndex | Team, RoundScore>();

  for (const [key, score] of Object.entries(event.payload.totalScores)) {
    const playerOrTeam = parseInt(key) as PlayerIndex | Team;
    totalScores.set(playerOrTeam, score);
  }

  for (const [key, score] of Object.entries(event.payload.scores)) {
    const playerOrTeam = parseInt(key) as PlayerIndex | Team;
    roundScores.set(playerOrTeam, { melds: score.melds, tricks: score.tricks, total: score.total });
  }

  return {
    ...state,
    phase: 'scoring',
    totalScores,
    roundScores,
  };
}
```

Add `RoundScore` and `Team` to the import at the top of `reducer.ts` (currently it only imports `Card, GameEvent, GameState, PlayerIndex, Trick`):

```typescript
import {
  Card,
  GameEvent,
  GameState,
  PlayerIndex,
  RoundScore,
  Team,
  Trick,
} from '@dabb/shared-types';
```

- [ ] **Step 4: Run the test again to confirm it passes**

```bash
pnpm --filter @dabb/game-logic test roundScores
```

Expected: PASS — both tests green.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
pnpm --filter @dabb/game-logic test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/game-logic/src/state/reducer.ts packages/game-logic/src/__tests__/roundScores.test.ts
git commit -m "$(cat <<'EOF'
fix(game-logic): populate roundScores in ROUND_SCORED reducer

ScoreboardStrip was always empty because handleRoundScored never set
state.roundScores — it only updated totalScores. Now both are populated
from the event payload. bidMet is stripped since RoundScore doesn't include it.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scoreboard History Modal

**Files:**

- Create: `apps/client/src/components/game/ScoreboardModal.tsx`
- Modify: `apps/client/src/components/game/ScoreboardStrip.tsx`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Create `ScoreboardModal.tsx`**

Create `apps/client/src/components/game/ScoreboardModal.tsx`:

```tsx
/**
 * ScoreboardModal — full round history shown when user taps the scoreboard strip.
 */
import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { PlayerIndex, RoundHistoryEntry } from '@dabb/shared-types';
import type { RoundHistoryResult } from '@dabb/ui-shared';

export interface ScoreboardModalProps {
  visible: boolean;
  onClose: () => void;
  rounds: RoundHistoryEntry[];
  currentRound: RoundHistoryResult['currentRound'];
  nicknames: Map<PlayerIndex, string>;
  playerCount: number;
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
}

export function ScoreboardModal({
  visible,
  onClose,
  rounds,
  currentRound,
  nicknames,
  playerCount,
  totalScores,
}: ScoreboardModalProps) {
  const playerIndices = Array.from({ length: playerCount }, (_, i) => i as PlayerIndex);

  function name(pi: PlayerIndex) {
    return nicknames.get(pi) ?? `P${pi}`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Score History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Column headers */}
          <View style={styles.row}>
            <Text style={[styles.cell, styles.roundCell, styles.headerText]}>Rd</Text>
            <Text style={[styles.cell, styles.bidCell, styles.headerText]}>Bid</Text>
            {playerIndices.map((pi) => (
              <Text key={pi} style={[styles.cell, styles.playerCell, styles.headerText]}>
                {name(pi)}
              </Text>
            ))}
          </View>

          <ScrollView>
            {/* Completed rounds */}
            {rounds.map((round) => (
              <View key={round.round} style={styles.row}>
                <Text style={[styles.cell, styles.roundCell]}>{round.round}</Text>
                <Text style={[styles.cell, styles.bidCell]}>
                  {round.bidWinner !== null ? `${name(round.bidWinner)} ${round.winningBid}` : '—'}
                </Text>
                {playerIndices.map((pi) => {
                  const score = round.scores?.[pi];
                  return (
                    <View key={pi} style={[styles.cell, styles.playerCell]}>
                      {score ? (
                        <>
                          <Text style={styles.scoreDetail}>
                            {score.melds}m + {score.tricks}t
                          </Text>
                          <Text
                            style={[styles.scoreTotal, score.bidMet ? styles.bidMet : undefined]}
                          >
                            {score.total}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.scoreTotal}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Current in-progress round */}
            {currentRound && (
              <View style={[styles.row, styles.currentRow]}>
                <Text style={[styles.cell, styles.roundCell]}>{currentRound.round}</Text>
                <Text style={[styles.cell, styles.bidCell]}>
                  {currentRound.bidWinner !== null
                    ? `${name(currentRound.bidWinner)} ${currentRound.winningBid}`
                    : '—'}
                </Text>
                {playerIndices.map((pi) => (
                  <Text key={pi} style={[styles.cell, styles.playerCell, styles.scoreTotal]}>
                    —
                  </Text>
                ))}
              </View>
            )}

            {/* Totals row */}
            <View style={[styles.row, styles.totalsRow]}>
              <Text style={[styles.cell, styles.roundCell, styles.totalsLabel]}>Total</Text>
              <Text style={[styles.cell, styles.bidCell]} />
              {playerIndices.map((pi) => {
                const entry = totalScores.find((t) => t.playerIndex === pi);
                return (
                  <Text key={pi} style={[styles.cell, styles.playerCell, styles.totalsValue]}>
                    {entry?.score ?? 0}
                  </Text>
                );
              })}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#2a1a0a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#5a3a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#c8b090',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#3a2a1a',
    alignItems: 'center',
  },
  currentRow: {
    backgroundColor: 'rgba(201,127,0,0.1)',
  },
  totalsRow: {
    borderTopWidth: 2,
    borderTopColor: '#5a3a1a',
    marginTop: 4,
    paddingTop: 8,
  },
  cell: {
    paddingHorizontal: 4,
  },
  roundCell: {
    width: 28,
    color: '#c8b090',
    fontSize: 12,
    textAlign: 'center',
  },
  bidCell: {
    flex: 1,
    color: '#c8b090',
    fontSize: 11,
  },
  playerCell: {
    width: 60,
    alignItems: 'center',
  },
  headerText: {
    color: '#f2e8d0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  scoreDetail: {
    fontSize: 10,
    color: '#c8b090',
    textAlign: 'center',
  },
  scoreTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f2e8d0',
    textAlign: 'center',
  },
  bidMet: {
    color: '#6bcb77',
  },
  totalsLabel: {
    color: '#f2e8d0',
    fontWeight: 'bold',
  },
  totalsValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#c97f00',
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Make `ScoreboardStrip` tappable**

In `apps/client/src/components/game/ScoreboardStrip.tsx`:

Add `TouchableOpacity` import from `react-native`, and add `onPress?: () => void` to `ScoreboardStripProps`. Wrap the root `<View style={styles.strip}>` in a `TouchableOpacity` with the `onPress` prop. Add `minHeight: 36` to the `strip` style so the area never collapses to zero even when `roundScores` is empty (prevents layout shift per CLAUDE.md rule 2).

Replace the early return `return <View />;` with returning the strip layout (still empty but with the stable minHeight — `roundScores.length === 0` just means no player entries are rendered, not that the component disappears):

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PlayerIndex } from '@dabb/shared-types';

export interface ScoreboardStripProps {
  roundScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  myPlayerIndex: PlayerIndex;
  targetScore: number;
  onPress?: () => void;
}

export function ScoreboardStrip({
  roundScores,
  totalScores,
  myPlayerIndex,
  targetScore,
  onPress,
}: ScoreboardStripProps) {
  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
      {roundScores.map((entry) => {
        const total = totalScores.find((t) => t.playerIndex === entry.playerIndex);
        const isMe = entry.playerIndex === myPlayerIndex;
        return (
          <View
            key={entry.playerIndex}
            style={[styles.playerEntry, isMe && styles.playerEntryHighlight]}
          >
            <Text style={[styles.roundScore, isMe && styles.roundScoreHighlight]}>
              {entry.score}
            </Text>
            <Text style={[styles.totalScore, isMe && styles.totalScoreHighlight]}>
              {total !== undefined ? total.score : 0}
            </Text>
          </View>
        );
      })}
      <View style={styles.targetEntry}>
        <Text style={styles.targetLabel}>Target:</Text>
        <Text style={styles.targetValue}>{targetScore}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a0a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    minHeight: 36,
  },
  playerEntry: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 44,
  },
  playerEntryHighlight: {
    backgroundColor: '#c97f00',
  },
  roundScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  roundScoreHighlight: {
    color: '#fff',
  },
  totalScore: {
    fontSize: 11,
    color: '#c8b090',
  },
  totalScoreHighlight: {
    color: '#ffe8b0',
  },
  targetEntry: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetLabel: {
    fontSize: 11,
    color: '#c8b090',
  },
  targetValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
});
```

- [ ] **Step 3: Wire the modal in `GameScreen.tsx`**

In `apps/client/src/components/ui/GameScreen.tsx`, make these changes:

**Imports — add:**

```tsx
import { useRoundHistory } from '@dabb/ui-shared';
import { ScoreboardModal } from '../game/ScoreboardModal.js';
```

**State — add inside `GameScreen`:**

```tsx
const [scoreboardOpen, setScoreboardOpen] = useState(false);
```

**Hook call — add near the other hook calls:**

```tsx
const { rounds, currentRound } = useRoundHistory(events);
```

**ScoreboardStrip — add `onPress`:**

```tsx
<ScoreboardStrip
  roundScores={roundScores}
  totalScores={totalScores}
  myPlayerIndex={playerIndex}
  targetScore={state.targetScore}
  onPress={() => setScoreboardOpen(true)}
/>
```

**Modal — add before the closing `</View>` of the root container:**

```tsx
{
  /* Scoreboard history modal */
}
<ScoreboardModal
  visible={scoreboardOpen}
  onClose={() => setScoreboardOpen(false)}
  rounds={rounds}
  currentRound={currentRound}
  nicknames={nicknames}
  playerCount={state.playerCount}
  totalScores={totalScores}
/>;
```

- [ ] **Step 4: Build to verify types**

```bash
pnpm run build
```

Expected: exits with 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/ScoreboardModal.tsx \
        apps/client/src/components/game/ScoreboardStrip.tsx \
        apps/client/src/components/ui/GameScreen.tsx
git commit -m "$(cat <<'EOF'
feat(client): add tappable scoreboard history modal

Tapping the scoreboard strip opens a modal showing full round history
(bid winner, melds/tricks/total per player, cumulative totals) using
the existing useRoundHistory hook.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Remove dead exports

**Files:**

- Modify: `packages/ui-shared/src/index.ts`
- Delete: `packages/ui-shared/src/useLocalStorage.ts`

Do this now (before celebration/sound tasks) so the deleted file is gone before we start touching other things.

- [ ] **Step 1: Remove dead exports from `index.ts`**

In `packages/ui-shared/src/index.ts`, remove these three lines:

```typescript
export { useSessionCredentials } from './useLocalStorage.js';
export { useActionRequired, useActionRequiredCallback } from './useActionRequired.js';
export type { ActionRequiredResult } from './useActionRequired.js';
```

Replace the `useActionRequired` line with (keep only the callback):

```typescript
export { useActionRequiredCallback } from './useActionRequired.js';
```

The final `index.ts` should be:

```typescript
export { useSocket } from './useSocket.js';
export { useGameState } from './useGameState.js';
export { useRoundHistory } from './useRoundHistory.js';
export type { RoundHistoryResult } from './useRoundHistory.js';
export { useGameLog } from './useGameLog.js';
export type { GameLogResult } from './useGameLog.js';
export { useActionRequiredCallback } from './useActionRequired.js';
export { useCelebration } from './useCelebration.js';
export type { CelebrationResult } from './useCelebration.js';
export { useTrickAnimationState } from './useTrickAnimationState.js';
export type { TrickAnimationResult, TrickAnimPhase } from './useTrickAnimationState.js';
export { useVersionCheck } from './useVersionCheck.js';
```

- [ ] **Step 2: Delete `useLocalStorage.ts`**

```bash
rm packages/ui-shared/src/useLocalStorage.ts
```

- [ ] **Step 3: Build to verify nothing broke**

```bash
pnpm run build
```

Expected: 0 errors. If anything imported `useSessionCredentials` or `useActionRequired` by name, the build will catch it.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-shared/src/index.ts
git rm packages/ui-shared/src/useLocalStorage.ts
git commit -m "$(cat <<'EOF'
refactor(ui-shared): remove unused dead exports

Remove useSessionCredentials (and its file), the public useActionRequired
export (still used internally by useActionRequiredCallback), and
ActionRequiredResult type — none were consumed outside the package.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Celebration, Version Check, Turn Notification, and Sounds

### Task 3: Wire `useCelebration` with Skia particle animations

**Files:**

- Modify: `apps/client/src/components/game/CelebrationLayer.tsx`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Rewrite `CelebrationLayer.tsx` with Skia animations**

Replace the entire file content of `apps/client/src/components/game/CelebrationLayer.tsx`:

```tsx
/**
 * CelebrationLayer — full-screen Skia particle overlay for round/game wins.
 * Always mounted; visibility controlled via opacity per CLAUDE.md rule 2.
 *
 * - showConfetti: local player won the round bid (confetti + "You won the round!")
 * - showFireworks: local player won the game (fireworks + "You won the game!")
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';

export interface CelebrationLayerProps {
  showConfetti: boolean;
  showFireworks: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  color: string;
  w: number;
  h: number;
  opacity: number;
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f40'];
const FIREWORK_COLORS = ['#ffd93d', '#ff6b6b', '#4d96ff', '#c77dff', '#6bcb77', '#ffffff'];
const PARTICLE_LIFETIME_MS = 3000;

function createConfetti(width: number, _height: number): Particle[] {
  return Array.from({ length: 60 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.15,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: 7 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    opacity: 1,
  }));
}

function createFireworks(width: number, height: number): Particle[] {
  const origins = [
    { x: width * 0.25, y: height * 0.35 },
    { x: width * 0.75, y: height * 0.25 },
    { x: width * 0.5, y: height * 0.45 },
  ];
  const particles: Particle[] = [];
  for (const origin of origins) {
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        vr: 0,
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        w: 4,
        h: 4,
        opacity: 1,
      });
    }
  }
  return particles;
}

function stepParticles(particles: Particle[], gravity: number): void {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += gravity;
    p.rotation += p.vr;
    p.opacity = Math.max(0, p.opacity - 0.008);
  }
}

export function CelebrationLayer({ showConfetti, showFireworks }: CelebrationLayerProps) {
  const { width, height } = useWindowDimensions();
  const particles = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    particles.current = [];
    setTick((t) => t + 1);
  }, []);

  const startAnimation = useCallback(
    (isConfetti: boolean) => {
      stopAnimation();
      particles.current = isConfetti
        ? createConfetti(width, height)
        : createFireworks(width, height);
      const gravity = isConfetti ? 0.12 : 0.05;

      const animate = () => {
        stepParticles(particles.current, gravity);
        setTick((t) => t + 1);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      timerRef.current = setTimeout(stopAnimation, PARTICLE_LIFETIME_MS);
    },
    [width, height, stopAnimation]
  );

  useEffect(() => {
    if (showConfetti) {
      startAnimation(true);
    } else if (showFireworks) {
      startAnimation(false);
    } else {
      stopAnimation();
    }
    return stopAnimation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfetti, showFireworks]);

  const visible = showConfetti || showFireworks || particles.current.length > 0;
  const message = showFireworks ? 'You won the game!' : showConfetti ? 'You won the round!' : '';

  return (
    <View style={[styles.overlay, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {particles.current.map((p, i) => (
          // Use translate-based pivot for rotation (origin prop not reliable across Skia v2 versions)
          <Group
            key={i}
            transform={[
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rotation },
              { translateX: -p.x },
              { translateY: -p.y },
            ]}
          >
            <Rect
              x={p.x - p.w / 2}
              y={p.y - p.h / 2}
              width={p.w}
              height={p.h}
              color={p.color}
              opacity={p.opacity}
            />
          </Group>
        ))}
      </Canvas>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    pointerEvents: 'none',
  },
  message: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
});
```

- [ ] **Step 2: Update `GameScreen.tsx` to use `useCelebration`**

In `apps/client/src/components/ui/GameScreen.tsx`:

**Import — add `useCelebration` to the `@dabb/ui-shared` import:**

```tsx
import { useGameLog, useTrickAnimationState, useCelebration } from '@dabb/ui-shared';
```

**Remove the old celebration logic** (find and delete these two lines):

```tsx
const showCelebration = state.phase === 'scoring';
const celebrationMessage = showCelebration ? 'Round complete!' : '';
```

**Add the new hook call** (near other hooks):

```tsx
const { showConfetti, showFireworks } = useCelebration(events, playerIndex);
```

**Update `CelebrationLayer` props** (replace the old usage):

```tsx
<CelebrationLayer showConfetti={showConfetti} showFireworks={showFireworks} />
```

- [ ] **Step 3: Build to verify**

```bash
pnpm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/game/CelebrationLayer.tsx \
        apps/client/src/components/ui/GameScreen.tsx
git commit -m "$(cat <<'EOF'
feat(client): wire useCelebration with Skia particle animations

Replace the dumb phase=scoring check with useCelebration which correctly
shows confetti only for the bid winner and fireworks only for the game
winner. CelebrationLayer now renders Skia particle effects.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire `useVersionCheck` to gate app on startup

**Files:**

- Modify: `apps/client/src/app/_layout.tsx`

- [ ] **Step 1: Update `_layout.tsx`**

In `apps/client/src/app/_layout.tsx`, make these changes:

**Add imports:**

```tsx
import { useVersionCheck } from '@dabb/ui-shared';
import { APP_VERSION, SERVER_URL } from '../constants.js';
import UpdateRequiredScreen from '../components/ui/UpdateRequiredScreen.js';
```

**Add hook call** inside `RootLayout` (after `useFonts`):

```tsx
const { needsUpdate, isLoading: versionLoading } = useVersionCheck({
  currentVersion: APP_VERSION,
  serverBaseUrl: SERVER_URL,
});
```

**Extend the existing fonts guard** to also cover version loading (replace the existing `if (!fontsLoaded) return null;`):

```tsx
if (!fontsLoaded || versionLoading) {
  return null;
}
```

**Add the update gate** right after the guard (before the `return` with JSX):

```tsx
if (needsUpdate) {
  return <UpdateRequiredScreen />;
}
```

The final `RootLayout` function body:

```tsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  const { needsUpdate, isLoading: versionLoading } = useVersionCheck({
    currentVersion: APP_VERSION,
    serverBaseUrl: SERVER_URL,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || versionLoading) {
    return null;
  }

  if (needsUpdate) {
    return <UpdateRequiredScreen />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(client): wire useVersionCheck to gate app on startup

When the server reports a higher major version the app now renders
UpdateRequiredScreen instead of the navigation stack. Version loading
shares the existing splash-screen guard to avoid a second conditional
mount.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire `useTurnNotification` in `GameScreen`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Add the hook call**

In `apps/client/src/components/ui/GameScreen.tsx`:

**Add import:**

```tsx
import { useTurnNotification } from '../../hooks/useTurnNotification.js';
```

**Add hook call** alongside the other hooks (e.g. after the `trickAnimState` line):

```tsx
useTurnNotification(state, playerIndex);
```

- [ ] **Step 2: Build to verify**

```bash
pnpm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "$(cat <<'EOF'
feat(client): wire useTurnNotification in GameScreen

Plays notification.ogg via expo-audio when it becomes the local
player's turn to act.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire game sound effects

**Files:**

- Modify: `apps/client/src/app/_layout.tsx`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`
- Modify: `apps/client/src/components/game/PlayerHand.tsx`

- [ ] **Step 1: Load sound preferences on app start**

In `apps/client/src/app/_layout.tsx`:

**Add import:**

```tsx
import { loadSoundPreferences } from '../utils/sounds.js';
```

**Add a new `useEffect`** (after the existing font `useEffect`):

```tsx
useEffect(() => {
  void loadSoundPreferences();
}, []);
```

- [ ] **Step 2: Wire event-driven sounds in `GameScreen.tsx`**

In `apps/client/src/components/ui/GameScreen.tsx`:

**Add import:**

```tsx
import { playSound } from '../../utils/sounds.js';
```

**Add a `useRef` and `useEffect`** for sound playback (add after existing hooks, near the top of the component body after `events` is available from `useGame`):

```tsx
// Sound effects: play on new events. Initialized to events.length at first render
// so existing events are skipped. Note: if the component remounts (reconnect),
// events.length may be 0 causing a brief replay — acceptable for this use case.
const lastSoundedEventIdx = useRef(events.length);
useEffect(() => {
  const newEvents = events.slice(lastSoundedEventIdx.current);
  lastSoundedEventIdx.current = events.length;
  for (const event of newEvents) {
    switch (event.type) {
      case 'CARDS_DEALT':
        playSound('card-deal');
        break;
      case 'CARD_PLAYED':
        playSound('card-play');
        break;
      case 'BID_PLACED':
        playSound('bid-place');
        break;
      case 'PLAYER_PASSED':
        playSound('pass');
        break;
      case 'TRICK_WON':
        playSound('trick-win');
        break;
      case 'GAME_FINISHED':
        playSound('game-win');
        break;
    }
  }
}, [events]);
```

- [ ] **Step 3: Wire `card-select` sound in `PlayerHand.tsx`**

In `apps/client/src/components/game/PlayerHand.tsx`:

**Add import:**

```tsx
import { playSound } from '../../utils/sounds.js';
```

**Update the `onTap` callback** to play the sound before calling `onPlayCard`:

```tsx
onTap={
  isTricksPhase && isValid
    ? () => {
        playSound('card-select');
        onPlayCard(card.id);
      }
    : undefined
}
```

- [ ] **Step 4: Build to verify**

```bash
pnpm run build
```

Expected: 0 errors.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/app/_layout.tsx \
        apps/client/src/components/ui/GameScreen.tsx \
        apps/client/src/components/game/PlayerHand.tsx
git commit -m "$(cat <<'EOF'
feat(client): wire game sound effects

Load mute preference on startup; play card-deal, card-play, bid-place,
pass, trick-win, and game-win sounds on matching events. Play card-select
when tapping a card in the tricks phase.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

After all tasks are complete:

- [ ] **Run full CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm format:check
```

Expected: all pass, 0 errors.
