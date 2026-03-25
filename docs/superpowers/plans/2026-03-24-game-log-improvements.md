# Game Log Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the in-game log UI: chronological entry ordering, auto-scroll follow, no event count in heading, and always-visible meld card details.

**Architecture:** Four changes across three files — `useGameLog.ts` (ordering logic), `GameLogTab.tsx` (UI + new entry type), and `GameScreen.tsx` (builds rich entries). The `RichLogEntry` / `MeldDetail` types are exported from `GameLogTab.tsx` so `GameScreen.tsx` can construct them. No new files needed.

**Tech Stack:** React Native, TypeScript (strict, ES2022), Vitest, `@dabb/shared-types`, `@dabb/game-logic`, `@dabb/i18n`

---

## File Map

| File                                                  | Role                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/ui-shared/src/useGameLog.ts`                | Hook: remove reverse, fix latestEntries, rewrite synthesizeLastImportantEntry                              |
| `packages/ui-shared/src/__tests__/useGameLog.test.ts` | Tests: add ordering assertions, add melds_summary merge test                                               |
| `apps/client/src/components/game/GameLogTab.tsx`      | UI: export RichLogEntry/MeldDetail types; accept them; remove count; add scroll follow; render detail rows |
| `apps/client/src/components/ui/GameScreen.tsx`        | Integration: build `RichLogEntry[]` instead of `string[]`                                                  |

---

## Task 1: Fix entry ordering and `synthesizeLastImportantEntry` in `useGameLog.ts`

**Files:**

- Modify: `packages/ui-shared/src/useGameLog.ts`
- Test: `packages/ui-shared/src/__tests__/useGameLog.test.ts`

Run tests with: `pnpm --filter @dabb/ui-shared test`

- [ ] **Step 1: Add two failing tests for the new ordering behaviour**

In `packages/ui-shared/src/__tests__/useGameLog.test.ts`, add a new `describe` block after the existing one:

```typescript
describe('useGameLog — entry ordering', () => {
  it('entries are in chronological order (oldest first)', () => {
    // sequences 1, 2, 3 match insertion order — no sorting, just pass-through
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, bidPlacedEvent], null, null)
    );
    expect(result.current.entries[0].type).toBe('game_started');
    expect(result.current.entries[1].type).toBe('trick_won');
    expect(result.current.entries[2].type).toBe('bid_placed');
  });

  it('latestEntries are the last N entries in chronological order', () => {
    const manyBids = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id: `bid-${i}`,
        sequence: 10 + i,
        type: 'BID_PLACED',
        payload: { playerIndex: 0, amount: 150 + i * 10 },
      })
    );
    const { result } = renderHook(() => useGameLog([startedEvent, ...manyBids], null, null));
    expect(result.current.latestEntries).toHaveLength(5);
    // Last 5 of 7 entries = bids 1–5, oldest-first (ascending amounts)
    const amounts = result.current.latestEntries.map((e) =>
      e.data.kind === 'bid_placed' ? e.data.amount : null
    );
    expect(amounts).toEqual([160, 170, 180, 190, 200]);
  });

  it('merges consecutive melds_declared into melds_summary in chronological order', () => {
    const melds1 = makeEvent({
      id: 'em1',
      sequence: 6,
      type: 'MELDS_DECLARED',
      payload: { playerIndex: 0, melds: [], totalPoints: 40 },
    });
    const melds2 = makeEvent({
      id: 'em2',
      sequence: 7,
      type: 'MELDS_DECLARED',
      payload: { playerIndex: 1, melds: [], totalPoints: 60 },
    });
    const { result } = renderHook(() => useGameLog([melds1, melds2], null, null));
    const entry = result.current.lastImportantEntry;
    expect(entry?.type).toBe('melds_summary');
    if (entry?.data.kind === 'melds_summary') {
      // playerMelds must be chronological: player 0 then player 1
      expect(entry.data.playerMelds).toEqual([
        { playerIndex: 0, totalPoints: 40 },
        { playerIndex: 1, totalPoints: 60 },
      ]);
    }
  });
});
```

- [ ] **Step 2: Run the tests — verify the two ordering tests fail**

```bash
pnpm --filter @dabb/ui-shared test
```

Expected: "entries are in chronological order" FAILS (entries are reversed today), "latestEntries are the last N" FAILS (order is reversed). The melds_summary test also passes today (the old code reverses internally and the end result is the same) — that is expected and fine.

- [ ] **Step 3: Rewrite `useGameLog.ts`**

Replace the entire file with the following. Key changes: remove `.reverse()`, update `latestEntries` to `slice(-N)`, update JSDoc, rewrite `synthesizeLastImportantEntry` to use a reverse scan + forward collect.

```typescript
/**
 * Hook to convert game events to log entries for display
 */

import { useMemo } from 'react';
import type { GameEvent, GameLogEntry, GameState, PlayerIndex, Team } from '@dabb/shared-types';

const DEFAULT_VISIBLE_ENTRIES = 5;

const IMPORTANT_ENTRY_TYPES = new Set<GameLogEntry['type']>([
  'going_out',
  'trick_won',
  'round_scored',
  'melds_declared',
  'game_finished',
]);

export interface GameLogResult {
  /** All log entries in chronological order (oldest first) */
  entries: GameLogEntry[];
  /** The latest N entries for collapsed view (last N, chronological order) */
  latestEntries: GameLogEntry[];
  /** The most recent entry considered important (going out, trick/meld/round/game won) */
  lastImportantEntry: GameLogEntry | null;
  /** Whether it's the current player's turn */
  isYourTurn: boolean;
}

/**
 * Converts game events to displayable log entries
 * Skips secret events (CARDS_DEALT, CARDS_DISCARDED, MELDING_COMPLETE)
 */
export function useGameLog(
  events: GameEvent[],
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): GameLogResult {
  return useMemo(() => {
    const entries: GameLogEntry[] = [];
    const playerTeamData = new Map<PlayerIndex, { nickname: string; team: Team }>();

    for (const event of events) {
      // Track player team data from PLAYER_JOINED events
      if (event.type === 'PLAYER_JOINED' && event.payload.team !== undefined) {
        playerTeamData.set(event.payload.playerIndex, {
          nickname: event.payload.nickname,
          team: event.payload.team,
        });
      }

      const logEntry = eventToLogEntry(event);
      if (logEntry) {
        entries.push(logEntry);
      }

      // After GAME_STARTED in 4-player, emit team announcement
      if (event.type === 'GAME_STARTED' && event.payload.playerCount === 4) {
        const team0 = [...playerTeamData.values()]
          .filter((p) => p.team === 0)
          .map((p) => p.nickname);
        const team1 = [...playerTeamData.values()]
          .filter((p) => p.team === 1)
          .map((p) => p.nickname);
        if (team0.length > 0 && team1.length > 0) {
          entries.push({
            id: `${event.id}-teams`,
            timestamp: event.timestamp,
            type: 'teams_announced',
            playerIndex: null,
            data: { kind: 'teams_announced', team0, team1 },
          });
        }
      }
    }

    // Determine if it's the current player's turn
    const isYourTurn =
      currentPlayerIndex !== null &&
      state !== null &&
      state.currentPlayer === currentPlayerIndex &&
      (state.phase === 'bidding' || state.phase === 'tricks');

    const lastImportantEntry = synthesizeLastImportantEntry(entries);

    return {
      entries,
      latestEntries: entries.slice(-DEFAULT_VISIBLE_ENTRIES),
      lastImportantEntry,
      isYourTurn,
    };
  }, [events, state, currentPlayerIndex]);
}

/**
 * Finds the most recent important log entry, merging consecutive melds_declared
 * entries into a single melds_summary entry for the collapsed view.
 *
 * Receives entries in chronological order (oldest first).
 */
function synthesizeLastImportantEntry(entries: GameLogEntry[]): GameLogEntry | null {
  // Reverse scan to find the last important entry
  let foundIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (IMPORTANT_ENTRY_TYPES.has(entries[i].type)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return null;
  }

  const found = entries[foundIndex];
  if (found.type !== 'melds_declared') {
    return found;
  }

  // Find the start of the contiguous melds_declared run by scanning backwards
  let startIndex = foundIndex;
  while (startIndex > 0 && entries[startIndex - 1].type === 'melds_declared') {
    startIndex--;
  }

  if (startIndex === foundIndex) {
    // Only one melds_declared entry
    return found;
  }

  // Collect entries startIndex..foundIndex inclusive — already chronological (oldest first)
  const meldEntries = entries.slice(startIndex, foundIndex + 1);

  return {
    id: found.id,
    timestamp: found.timestamp,
    type: 'melds_summary',
    playerIndex: null,
    data: {
      kind: 'melds_summary',
      playerMelds: meldEntries.map((e) => ({
        playerIndex: e.playerIndex as PlayerIndex,
        totalPoints: e.data.kind === 'melds_declared' ? e.data.totalPoints : 0,
      })),
    },
  };
}

/**
 * Converts a single game event to a log entry
 * Returns null for secret events that shouldn't be logged
 */
function eventToLogEntry(event: GameEvent): GameLogEntry | null {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_started',
        playerIndex: null,
        data: {
          kind: 'game_started',
          playerCount: event.payload.playerCount,
          targetScore: event.payload.targetScore,
        },
      };

    case 'NEW_ROUND_STARTED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'round_started',
        playerIndex: null,
        data: {
          kind: 'round_started',
          round: event.payload.round,
        },
      };

    case 'BID_PLACED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'bid_placed',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'bid_placed',
          amount: event.payload.amount,
        },
      };

    case 'PLAYER_PASSED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'player_passed',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'player_passed',
        },
      };

    case 'BIDDING_WON':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'bidding_won',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'bidding_won',
          winningBid: event.payload.winningBid,
        },
      };

    case 'GOING_OUT':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'going_out',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'going_out',
          suit: event.payload.suit,
        },
      };

    case 'TRUMP_DECLARED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'trump_declared',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'trump_declared',
          suit: event.payload.suit,
        },
      };

    case 'MELDS_DECLARED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'melds_declared',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'melds_declared',
          melds: event.payload.melds,
          totalPoints: event.payload.totalPoints,
        },
      };

    case 'CARD_PLAYED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'card_played',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'card_played',
          card: event.payload.card,
        },
      };

    case 'TRICK_WON':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'trick_won',
        playerIndex: event.payload.winnerIndex,
        data: {
          kind: 'trick_won',
          points: event.payload.points,
        },
      };

    case 'ROUND_SCORED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'round_scored',
        playerIndex: null,
        data: {
          kind: 'round_scored',
          scores: event.payload.scores,
        },
      };

    case 'GAME_FINISHED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_finished',
        playerIndex: null,
        data: {
          kind: 'game_finished',
          winner: event.payload.winner,
        },
      };

    case 'GAME_TERMINATED':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'game_terminated',
        playerIndex: event.payload.terminatedBy,
        data: {
          kind: 'game_terminated',
          reason: event.payload.reason,
        },
      };

    case 'DABB_TAKEN':
      return {
        id: event.id,
        timestamp: event.timestamp,
        type: 'dabb_taken',
        playerIndex: event.payload.playerIndex,
        data: {
          kind: 'dabb_taken',
          cards: event.payload.dabbCards,
        },
      };

    // Secret events that shouldn't be logged
    case 'CARDS_DEALT':
    case 'CARDS_DISCARDED':
    case 'MELDING_COMPLETE':
    case 'PLAYER_JOINED':
    case 'PLAYER_LEFT':
    case 'PLAYER_RECONNECTED':
      return null;

    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @dabb/ui-shared test
```

Expected: all tests pass, including the two new ordering tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-shared/src/useGameLog.ts packages/ui-shared/src/__tests__/useGameLog.test.ts
git commit -m "feat(game-log): return entries in chronological order (oldest first)"
```

---

## Task 2: Rewrite `GameLogTab.tsx` with rich entry types, scroll follow, and meld detail rows

**Files:**

- Modify: `apps/client/src/components/game/GameLogTab.tsx`

No automated tests for this component. TypeScript compilation is the verification step.

- [ ] **Step 1: Replace the entire `GameLogTab.tsx` with the new implementation**

```typescript
/**
 * GameLogTab — a collapsible panel showing recent game events in text form.
 * Always mounted; uses height/overflow to show/hide content (no conditional mount).
 * When collapsed, shows the last important event inline in the header.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface MeldDetail {
  name: string; // e.g. "Herz-Paar", "Binokel"
  cards: string[]; // e.g. ["Herz König", "Herz Ober"] — formatCard returns suit then rank
  points: number;
}

export interface RichLogEntry {
  key: string;
  text: string;
  detail?: MeldDetail[]; // Only set for melds_declared entries
}

export interface GameLogTabProps {
  entries: RichLogEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  collapsedSummary?: string;
}

export function GameLogTab({ entries, isExpanded, onToggle, collapsedSummary }: GameLogTabProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const isAtBottom = useRef(true);

  // Scroll to bottom when panel opens
  useEffect(() => {
    if (isExpanded && entries.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [isExpanded, entries.length]);

  // Follow new entries if already scrolled to the bottom.
  // Also fires when isExpanded changes — the isExpanded guard prevents scrolling
  // the hidden (height:0) ScrollView while collapsed. When the panel opens, this
  // effect fires alongside the open effect above; both calling scrollToEnd is harmless.
  useEffect(() => {
    if (isExpanded && isAtBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [entries.length, isExpanded]);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    isAtBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 8;
  }

  return (
    <View style={styles.container}>
      {/* Header — always visible */}
      <Pressable style={styles.header} onPress={onToggle}>
        <Text style={styles.headerTitle}>{t('gameLog.title')}</Text>
        {!isExpanded && collapsedSummary ? (
          <Text style={styles.collapsedSummary} numberOfLines={1}>
            {collapsedSummary}
          </Text>
        ) : (
          <View style={styles.collapsedSummaryPlaceholder} />
        )}
        <Text style={styles.toggleIcon}>{isExpanded ? '▼' : '▲'}</Text>
      </Pressable>

      {/* Content — always mounted; height collapses when not expanded */}
      <View style={isExpanded ? styles.contentExpanded : styles.contentCollapsed}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {entries.map((entry) => (
            <View key={entry.key}>
              <Text style={styles.entryText}>{entry.text}</Text>
              {entry.detail?.map((meld) => (
                <Text key={meld.name} style={styles.meldDetailText}>
                  {meld.name}: {meld.cards.join(', ')} ({meld.points})
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a0f05',
    borderTopWidth: 1,
    borderTopColor: '#3d2e18',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f2e8d0',
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
  toggleIcon: {
    fontSize: 12,
    color: '#c8b090',
  },
  contentCollapsed: {
    height: 0,
    overflow: 'hidden',
  },
  contentExpanded: {
    maxHeight: 200,
  },
  scrollView: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  entryText: {
    fontSize: 12,
    color: '#c8b090',
    paddingVertical: 2,
    lineHeight: 18,
  },
  meldDetailText: {
    fontSize: 11,
    color: '#8a7060',
    paddingLeft: 16,
    paddingBottom: 2,
    lineHeight: 16,
  },
});
```

- [ ] **Step 2: Type-check to verify no errors**

```bash
pnpm --filter @dabb/client run typecheck 2>&1 | head -40
```

Expected: TypeScript errors about `entries` type mismatch in `GameScreen.tsx` (we haven't updated it yet) — that is expected at this point.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/GameLogTab.tsx
git commit -m "feat(game-log): export RichLogEntry type, add scroll follow, always-visible meld details"
```

---

## Task 3: Update `GameScreen.tsx` to build `RichLogEntry[]`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Update imports in `GameScreen.tsx`**

Change the `@dabb/shared-types` import lines (currently at lines 29–30) to:

```typescript
import type { PlayerIndex, Card, GameLogEntry, Suit, Rank } from '@dabb/shared-types';
import { DABB_SIZE, SUIT_NAMES, formatMeldName } from '@dabb/shared-types';
```

Also add a type-only import for `RichLogEntry`. The value import for `GameLogTab` already exists at line 43 — do not duplicate it, only add:

```typescript
import type { RichLogEntry } from '../game/GameLogTab.js';
```

- [ ] **Step 2: Replace `logStrings` with `richLogEntries`**

Find the existing `logStrings` memo (currently around lines 195–198):

```typescript
const logStrings = useMemo(
  () => logEntries.map((e) => formatLogEntryText(e, nicknames, t)),
  [logEntries, nicknames, t]
);
```

Replace it with:

```typescript
const richLogEntries = useMemo(
  (): RichLogEntry[] =>
    logEntries.map((e) => ({
      key: e.id,
      text: formatLogEntryText(e, nicknames, t),
      detail:
        e.data.kind === 'melds_declared'
          ? e.data.melds.map((meld) => ({
              name: formatMeldName(meld, SUIT_NAMES),
              cards: meld.cards.map((cardId) => {
                const [suit, rank, copy] = cardId.split('-');
                return formatCard({
                  id: cardId,
                  suit: suit as Suit,
                  rank: rank as Rank,
                  copy: Number(copy) as 0 | 1,
                });
              }),
              points: meld.points,
            }))
          : undefined,
    })),
  [logEntries, nicknames, t]
);
```

- [ ] **Step 3: Update the `GameLogTab` usage**

Find the `<GameLogTab` JSX (currently around line 526):

```tsx
<GameLogTab
  entries={logStrings}
  collapsedSummary={collapsedSummary}
  isExpanded={logExpanded}
  onToggle={() => setLogExpanded((v) => !v)}
/>
```

Change `entries={logStrings}` to `entries={richLogEntries}`.

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat(game-log): build RichLogEntry with meld card details for always-visible display"
```

---

## Task 4: Run full CI verification

- [ ] **Step 1: Run CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm format:check
```

Expected: all pass. If lint flags the `NativeSyntheticEvent` import or any other issue, fix and amend the relevant commit.

- [ ] **Step 2: If all pass, done**

The feature is complete. All four improvements are live:

- Entries shown oldest-first, newest at bottom
- Log auto-scrolls to bottom on open; follows new entries when at bottom
- No event count `(N)` in the collapsed heading
- `melds_declared` entries show indented meld detail rows (meld name, card names, points)
