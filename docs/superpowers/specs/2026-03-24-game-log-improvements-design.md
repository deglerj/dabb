# Game Log Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

Four targeted improvements to the in-game log UI:

1. Chronological ordering (oldest first, newest at bottom)
2. Auto-scroll to latest on open; follow new entries when already at bottom
3. Remove event count from collapsed heading
4. Always-visible meld card details in `melds_declared` entries

---

## 1. Entry Ordering

**Current:** `useGameLog` reverses entries after building them, returning newest-first.

**Change:** Remove the `.reverse()` call. Entries are returned in chronological order (oldest first). Callers that scroll to end naturally show the newest events at the bottom.

Affected locations in `useGameLog.ts`:

- Remove `const reversedEntries = [...entries].reverse()`
- Return `entries` directly (chronological, oldest first)
- Update JSDoc on `entries` field: `"All log entries in chronological order (oldest first)"`
- `latestEntries` becomes `entries.slice(-DEFAULT_VISIBLE_ENTRIES)` (last N)
- Update JSDoc on `latestEntries` field accordingly

### `synthesizeLastImportantEntry` rewrite

The function currently receives newest-first entries and searches forward. After the ordering change it receives chronological (oldest-first) entries and must search from the end:

1. Use a reverse scan (not `findLastIndex` — that requires ES2023 and the project targets ES2022) to locate the last entry whose type is in `IMPORTANT_ENTRY_TYPES`. Call this index `foundIndex`.
2. If the found entry is not `melds_declared`, return it directly.
3. If it is `melds_declared`, find the start of the contiguous run: scan **backwards** from `foundIndex` toward index 0 to find the first entry in the run that is also `melds_declared`. Call this `startIndex`.
4. Collect entries from `startIndex` to `foundIndex` (inclusive) scanning **forward** — producing `meldEntries` in chronological (oldest first) order.
5. If `meldEntries.length === 1`, return that entry directly.
6. Otherwise map `meldEntries` to `melds_summary` — entries are already in chronological order, no reverse needed.
7. Remove the now-incorrect comment `"meldEntries is newest-first; reverse to get chronological order"`

---

## 2. Scroll Behaviour

### Open → scroll to bottom

Already implemented (`scrollRef.current?.scrollToEnd({ animated: false })` in a `useEffect` on `isExpanded`). Works correctly once ordering is chronological.

### Follow new entries when at bottom

`GameLogTab` gains:

- `isAtBottom` ref (`useRef(true)`) — not state, to avoid re-renders on every scroll event
- `onScroll` handler on the `ScrollView`: `isAtBottom.current = nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 8`
- `useEffect` on `entries.length`: **only if `isExpanded` is true** and `isAtBottom.current`, call `scrollRef.current?.scrollToEnd({ animated: true })`

The `isExpanded` guard prevents calling `scrollToEnd` on the hidden (height: 0) `ScrollView` while collapsed, and is the only guard needed — no need to add `isExpanded` to this effect's dependency array. When the panel opens, both this effect and the existing `isExpanded` effect fire together; both calling `scrollToEnd` in the same tick is harmless.

---

## 3. Remove Event Count

Delete `<Text style={styles.headerCount}>({entries.length})</Text>` and its `headerCount` style from `GameLogTab.tsx`. The `collapsedSummaryPlaceholder` `View` remains to hold flex space in the header row.

---

## 4. Always-Visible Meld Details

### New types (local to client)

```ts
// Exported from GameLogTab.tsx so GameScreen.tsx can construct values of this type
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
```

### Building rich entries in GameScreen.tsx

Replace `logStrings: string[]` with `richLogEntries: RichLogEntry[]`.

For each `GameLogEntry`:

- Call existing `formatLogEntryText` for `text`
- If `entry.data.kind === 'melds_declared'`, build `detail` from `entry.data.melds`:
  - `name`: call `formatMeldName(meld, SUIT_NAMES)` from `@dabb/shared-types` — produces `"Herz-Paar"` for suit-specific melds, `"Binokel"` / `"Vier Buaben"` etc. for others. This is consistent with the existing meld-name formatting in the codebase.
  - `cards`: for each `CardId` in `meld.cards`, split on `'-'` to get `[suit, rank, copy]`. Rank tokens are `ass`, `10`, `koenig`, `ober`, `buabe` — none contain a dash, so a 3-part split is always safe. Cast to `{ id: cardId, suit: suit as Suit, rank: rank as Rank, copy: Number(copy) as 0 | 1 }`, then call `formatCard`. `meld.cards` is guaranteed non-empty by game logic, so no guard is needed.
  - `points`: from `meld.points`
- Otherwise `detail` is `undefined`

`formatMeldName`, `SUIT_NAMES` are exported from `@dabb/shared-types`. `formatCard` is already imported from `@dabb/game-logic`.

### Rendering in GameLogTab

`GameLogTab` receives `entries: RichLogEntry[]` instead of `entries: string[]`.

Each entry renders:

1. Main text row, using `entry.key` as the React key (not array index).
2. If `detail` is present: indented rows for each meld, using `detail.name` as the React key (meld names are unique within a single player's meld set):
   ```
     Herz-Paar: Herz König, Herz Ober (20)
     Binokel: Schippe Ober, Bollen Buabe (40)
   ```
   (`formatCard` returns suit then rank: `"Herz König"`, not `"König Herz"`.)
   Styling: smaller font, muted colour (`#8a7060`), left padding (`20px`), no expand/collapse interaction.

---

## Files Changed

| File                                                  | Change                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui-shared/src/useGameLog.ts`                | Remove reverse; rewrite `synthesizeLastImportantEntry` for chronological order; update `latestEntries`; update JSDoc on `entries` and `latestEntries` fields |
| `packages/ui-shared/src/__tests__/useGameLog.test.ts` | Update assertions for new chronological order                                                                                                                |
| `apps/client/src/components/game/GameLogTab.tsx`      | Accept `RichLogEntry[]`; add `isAtBottom` ref + scroll follow (with `isExpanded` guard); remove count; render detail rows                                    |
| `apps/client/src/components/ui/GameScreen.tsx`        | Build `RichLogEntry[]` instead of `string[]`; use `formatMeldName` + `CardId` split for meld detail                                                          |

---

## Out of Scope

- Collapsible/expandable meld rows (explicitly removed in favour of always-visible)
- Changes to how the collapsed summary is computed or displayed
- Any other log entry types gaining detail rows
