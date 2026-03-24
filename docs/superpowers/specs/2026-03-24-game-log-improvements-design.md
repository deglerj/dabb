# Game Log Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

Five targeted improvements to the in-game log UI:

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
- Return `entries` directly
- `latestEntries` becomes `entries.slice(-DEFAULT_VISIBLE_ENTRIES)` (last N)
- `synthesizeLastImportantEntry` receives the chronological array and must search from the **end** rather than the beginning (find the last important entry, not the first)

---

## 2. Scroll Behaviour

### Open → scroll to bottom

Already implemented (`scrollRef.current?.scrollToEnd({ animated: false })` in a `useEffect` on `isExpanded`). Works correctly once ordering is chronological.

### Follow new entries when at bottom

`GameLogTab` gains:

- `isAtBottom` ref (not state — avoids re-renders) tracking whether the user has scrolled to the bottom
- `onScroll` handler: sets `isAtBottom = offset.y + layout.height >= content.height - 8` (8 px threshold)
- `useEffect` on `entries.length`: if `isAtBottom`, call `scrollRef.current?.scrollToEnd({ animated: true })`

Using a ref (not state) for `isAtBottom` prevents unnecessary re-renders on every scroll event.

---

## 3. Remove Event Count

Delete `<Text style={styles.headerCount}>({entries.length})</Text>` and its `headerCount` style from `GameLogTab.tsx`. The `collapsedSummaryPlaceholder` `View` remains to hold flex space in the header row.

---

## 4. Always-Visible Meld Details

### New types (local to client)

```ts
// In GameLogTab.tsx (not exported — internal to the component)
interface MeldDetail {
  name: string; // e.g. "Paar Herz"
  cards: string[]; // e.g. ["König Herz", "Ober Herz"]
  points: number;
}

interface RichLogEntry {
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
  - `name`: from `MELD_NAMES[meld.type]` + optional suit suffix (e.g. " Herz") using `formatSuit`
  - `cards`: parse each `CardId` (format `"suit-rank-copy"`) → reconstruct `Card` → `formatCard`
  - `points`: from `meld.points`
- Otherwise `detail` is `undefined`

`MELD_NAMES` is already exported from `@dabb/shared-types`. `formatCard`, `formatSuit` are already imported from `@dabb/game-logic`.

### Rendering in GameLogTab

`GameLogTab` receives `entries: RichLogEntry[]` instead of `entries: string[]`.

Each entry renders:

1. Main text row (unchanged appearance)
2. If `detail` is present: indented rows for each meld:
   ```
     Paar Herz: König Herz, Ober Herz (20)
     Binokel: Ober Schippe, Buabe Bollen (40)
   ```
   Styling: smaller font, muted colour (`#8a7060`), left padding (`20px`), no expand/collapse interaction.

---

## Files Changed

| File                                                  | Change                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/ui-shared/src/useGameLog.ts`                | Remove reverse; update `latestEntries` and `synthesizeLastImportantEntry`                       |
| `packages/ui-shared/src/__tests__/useGameLog.test.ts` | Update assertions for new chronological order                                                   |
| `apps/client/src/components/game/GameLogTab.tsx`      | Accept `RichLogEntry[]`; add `isAtBottom` ref + scroll follow; remove count; render detail rows |
| `apps/client/src/components/ui/GameScreen.tsx`        | Build `RichLogEntry[]` instead of `string[]`; parse `CardId` for meld detail                    |

---

## Out of Scope

- Collapsible/expandable meld rows (explicitly removed in favour of always-visible)
- Changes to how the collapsed summary is computed or displayed
- Any other log entry types gaining detail rows
