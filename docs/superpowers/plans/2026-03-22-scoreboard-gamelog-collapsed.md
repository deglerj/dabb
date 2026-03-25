# ScoreboardStrip & Collapsed Game Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show highest bid/bidder and current trump in the ScoreboardStrip, and display the last important game event inline in the collapsed GameLogTab header.

**Architecture:** Hook-first — `useGameLog` gets `lastImportantEntry` computed by scanning the existing `entries` array. `ScoreboardStrip` gets new props (`bidWinner`, `currentBid`, `trump`, `nicknames`) replacing `targetScore`. `GameScreen` wires everything together. All four touched files have clear single responsibilities; no new files.

**Tech Stack:** React Native + Expo (client), TypeScript strict, Vitest + @testing-library/react (tests), pnpm workspaces, @dabb/game-logic for `formatSuit`.

---

## File Map

| File                                                  | Change                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/ui-shared/src/useGameLog.ts`                | Add `lastImportantEntry: GameLogEntry \| null` to `GameLogResult`                                  |
| `packages/ui-shared/src/__tests__/useGameLog.test.ts` | New test file                                                                                      |
| `apps/client/src/components/game/GameLogTab.tsx`      | Add `collapsedSummary?: string` prop; show inline when collapsed                                   |
| `apps/client/src/components/game/ScoreboardStrip.tsx` | Replace `targetScore` with `bidWinner`, `currentBid`, `trump`, `nicknames`; render bid+trump block |
| `apps/client/src/components/ui/GameScreen.tsx`        | Wire new props to ScoreboardStrip; derive and pass `collapsedSummary` to GameLogTab                |

---

## Task 1: Add `lastImportantEntry` to `useGameLog`

**Files:**

- Create: `packages/ui-shared/src/__tests__/useGameLog.test.ts`
- Modify: `packages/ui-shared/src/useGameLog.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/ui-shared/src/__tests__/useGameLog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameLog } from '../useGameLog.js';
import type { GameEvent } from '@dabb/shared-types';

const baseEvent = {
  sessionId: 'session-1',
  timestamp: Date.now(),
};

function makeEvent(
  overrides: Partial<GameEvent> & { type: GameEvent['type']; id: string; sequence: number }
): GameEvent {
  return { ...baseEvent, ...overrides } as GameEvent;
}

const startedEvent = makeEvent({
  id: 'e1',
  sequence: 1,
  type: 'GAME_STARTED',
  payload: { playerCount: 3, targetScore: 1000, dealer: 0 },
});

const trickWonEvent = makeEvent({
  id: 'e2',
  sequence: 2,
  type: 'TRICK_WON',
  payload: { winnerIndex: 0, cards: [], points: 18 },
});

const bidPlacedEvent = makeEvent({
  id: 'e3',
  sequence: 3,
  type: 'BID_PLACED',
  payload: { playerIndex: 1, amount: 160 },
});

const meldsDeclaredEvent = makeEvent({
  id: 'e4',
  sequence: 4,
  type: 'MELDS_DECLARED',
  payload: { playerIndex: 0, melds: [], totalPoints: 60 },
});

const gameFinishedEvent = makeEvent({
  id: 'e5',
  sequence: 5,
  type: 'GAME_FINISHED',
  payload: { winner: 0, finalScores: { 0: 1200, 1: 800, 2: 650 } },
});

describe('useGameLog — lastImportantEntry', () => {
  it('is null when no events', () => {
    const { result } = renderHook(() => useGameLog([], null, null));
    expect(result.current.lastImportantEntry).toBeNull();
  });

  it('is null when only non-important events exist', () => {
    const { result } = renderHook(() => useGameLog([startedEvent, bidPlacedEvent], null, null));
    expect(result.current.lastImportantEntry).toBeNull();
  });

  it('returns the most recent important entry (trick_won)', () => {
    const { result } = renderHook(() => useGameLog([startedEvent, trickWonEvent], null, null));
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });

  it('returns the most recent important entry even when newer non-important events follow', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, bidPlacedEvent], null, null)
    );
    // entries are reverse-chronological; bidPlaced is newest but non-important
    // trickWon is the most recent important entry
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });

  it('returns the latest of multiple important entries', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, meldsDeclaredEvent], null, null)
    );
    expect(result.current.lastImportantEntry?.type).toBe('melds_declared');
  });

  it('returns game_finished when game is over', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, gameFinishedEvent], null, null)
    );
    expect(result.current.lastImportantEntry?.type).toBe('game_finished');
  });

  it('works when important entry is outside the top-5 latestEntries window', () => {
    const manyBids = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id: `bid-${i}`,
        sequence: 10 + i,
        type: 'BID_PLACED',
        payload: { playerIndex: 0, amount: 150 + i * 10 },
      })
    );
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, ...manyBids], null, null)
    );
    // trickWon is 7th from end — outside latestEntries window of 5
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @dabb/ui-shared test -- useGameLog
```

Expected: all 7 tests fail — `lastImportantEntry` does not exist yet.

- [ ] **Step 3: Implement `lastImportantEntry` in `useGameLog.ts`**

Open `packages/ui-shared/src/useGameLog.ts`. Add the constant and new field:

After the `DEFAULT_VISIBLE_ENTRIES` constant (line 8), add:

```typescript
const IMPORTANT_ENTRY_TYPES = new Set<GameLogEntry['type']>([
  'going_out',
  'trick_won',
  'round_scored',
  'melds_declared',
  'game_finished',
]);
```

In `GameLogResult`, add after `latestEntries`:

```typescript
/** The most recent entry considered important (going out, trick/meld/round/game won) */
lastImportantEntry: GameLogEntry | null;
```

In the return object of `useGameLog`, after `latestEntries`:

```typescript
lastImportantEntry: reversedEntries.find((e) => IMPORTANT_ENTRY_TYPES.has(e.type)) ?? null,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @dabb/ui-shared test -- useGameLog
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-shared/src/useGameLog.ts packages/ui-shared/src/__tests__/useGameLog.test.ts
git commit -m "feat(ui-shared): add lastImportantEntry to useGameLog result"
```

---

## Task 2: Add `collapsedSummary` prop to `GameLogTab`

**Files:**

- Modify: `apps/client/src/components/game/GameLogTab.tsx`

No tests for this component exist yet; the change is small and purely presentational. It will be verified visually via the GameScreen wiring in Task 4.

- [ ] **Step 1: Update `GameLogTabProps` and render the summary**

Open `apps/client/src/components/game/GameLogTab.tsx`.

Update the props interface:

```typescript
export interface GameLogTabProps {
  entries: string[];
  isExpanded: boolean;
  onToggle: () => void;
  collapsedSummary?: string;
}
```

Update the function signature to destructure the new prop:

```typescript
export function GameLogTab({ entries, isExpanded, onToggle, collapsedSummary }: GameLogTabProps) {
```

Replace the header `<Pressable>` content. The title must no longer have `flex: 1`; the summary text takes `flex: 1`. When expanded, the summary is hidden.

```tsx
<Pressable style={styles.header} onPress={onToggle}>
  <Text style={styles.headerTitle}>{t('gameLog.title')}</Text>
  <Text style={styles.headerCount}>({entries.length})</Text>
  {!isExpanded && collapsedSummary ? (
    <Text style={styles.collapsedSummary} numberOfLines={1}>
      {collapsedSummary}
    </Text>
  ) : (
    <View style={styles.collapsedSummaryPlaceholder} />
  )}
  <Text style={styles.toggleIcon}>{isExpanded ? '▼' : '▲'}</Text>
</Pressable>
```

Add the new styles (and remove `flex: 1` from `headerTitle`):

```typescript
headerTitle: {
  fontSize: 13,
  fontWeight: 'bold',
  color: '#f2e8d0',
  // no flex: 1 here
},
collapsedSummary: {
  flex: 1,
  fontSize: 12,
  color: '#c8b090',
  fontStyle: 'italic',
  paddingLeft: 4,
},
collapsedSummaryPlaceholder: {
  flex: 1,
},
```

- [ ] **Step 2: Build to catch type errors**

```bash
pnpm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/GameLogTab.tsx
git commit -m "feat(client): add collapsedSummary prop to GameLogTab header"
```

---

## Task 3: Update `ScoreboardStrip` with bid, trump, and bidder

**Files:**

- Modify: `apps/client/src/components/game/ScoreboardStrip.tsx`

- [ ] **Step 1: Update props and render bid/trump block**

Replace the entire contents of `apps/client/src/components/game/ScoreboardStrip.tsx` with:

```typescript
/**
 * ScoreboardStrip — a compact horizontal score display shown at the top of the game screen.
 * Shows round score + total score per player, highlighting the local player.
 * Shows highest bid/bidder and current trump on the right.
 * Tappable to open the scoreboard history modal.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PlayerIndex, Suit } from '@dabb/shared-types';
import { formatSuit } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';

export interface ScoreboardStripProps {
  roundScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  myPlayerIndex: PlayerIndex;
  bidWinner: PlayerIndex | null;
  currentBid: number;
  trump: Suit | null;
  nicknames: Map<PlayerIndex, string>;
  onPress?: () => void;
}

export function ScoreboardStrip({
  roundScores,
  totalScores,
  myPlayerIndex,
  bidWinner,
  currentBid,
  trump,
  nicknames,
  onPress,
}: ScoreboardStripProps) {
  const { t } = useTranslation();

  const bidderName = bidWinner !== null ? (nicknames.get(bidWinner) ?? `P${bidWinner}`) : null;
  const bidText = bidderName !== null ? `${bidderName} · ${currentBid}` : '—';
  const trumpText = trump !== null ? formatSuit(trump) : '—';

  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
      {roundScores.map((entry) => {
        const total = totalScores.find((s) => s.playerIndex === entry.playerIndex);
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
      <View style={styles.infoBlock}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('game.bidColumn')}:</Text>
          <Text style={[styles.infoValue, bidWinner === null && styles.infoValueEmpty]}>
            {bidText}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('game.trump')}:</Text>
          <Text style={[styles.infoValue, trump === null && styles.infoValueEmpty]}>
            {trumpText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a0a',
    paddingLeft: 8,
    paddingRight: 8,
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
  infoBlock: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: '#c8b090',
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  infoValueEmpty: {
    color: '#7a6a50',
    fontWeight: 'normal',
  },
});
```

- [ ] **Step 2: Build to catch type errors**

```bash
pnpm run build
```

Expected: TypeScript errors in `GameScreen.tsx` because it still passes the old `targetScore` prop and is missing the new ones. That's expected — they will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/ScoreboardStrip.tsx
git commit -m "feat(client): update ScoreboardStrip to show bid/bidder and trump"
```

---

## Task 4: Wire new props in `GameScreen`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Update `ScoreboardStrip` usage**

In `GameScreen.tsx`, find the `<ScoreboardStrip ... />` block (around line 352). Replace the props:

**Before:**

```tsx
<ScoreboardStrip
  roundScores={roundScores}
  totalScores={totalScores}
  myPlayerIndex={playerIndex}
  targetScore={state.targetScore}
  onPress={() => setScoreboardOpen(true)}
/>
```

**After:**

```tsx
<ScoreboardStrip
  roundScores={roundScores}
  totalScores={totalScores}
  myPlayerIndex={playerIndex}
  bidWinner={state.bidWinner}
  currentBid={state.currentBid}
  trump={state.trump}
  nicknames={nicknames}
  onPress={() => setScoreboardOpen(true)}
/>
```

- [ ] **Step 2: Derive `collapsedSummary` and pass to `GameLogTab`**

In `GameScreen.tsx`, find where `logStrings` is derived (a `useMemo` using `logEntries`). Destructure `lastImportantEntry` from `useGameLog`:

```typescript
const {
  entries: logEntries,
  lastImportantEntry,
  isYourTurn,
} = useGameLog(events, state, playerIndex);
```

Add a `collapsedSummary` derivation after the `logStrings` memo:

```typescript
const collapsedSummary = useMemo(
  () => (lastImportantEntry ? formatLogEntryText(lastImportantEntry, nicknames, t) : undefined),
  [lastImportantEntry, nicknames, t]
);
```

Update the `<GameLogTab ... />` usage to pass `collapsedSummary`:

```tsx
<GameLogTab
  entries={logStrings}
  isExpanded={logExpanded}
  onToggle={() => setLogExpanded((v) => !v)}
  collapsedSummary={collapsedSummary}
/>
```

- [ ] **Step 3: Build and verify no type errors**

```bash
pnpm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat(client): wire bid/trump to ScoreboardStrip and collapsedSummary to GameLogTab"
```

---

## Task 5: CI verification

- [ ] **Step 1: Run full CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm run typecheck
```

Expected: all pass with no errors or warnings.

- [ ] **Step 2: If CI passes, invoke `/ci-check` skill for final verification**

Run the `/ci-check` skill to confirm the build matches what GitHub CI would see.
