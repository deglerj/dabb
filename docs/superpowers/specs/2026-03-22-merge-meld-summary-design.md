# Design: Merge Meld Declarations in Collapsed Game Log Summary

**Date:** 2026-03-22
**Status:** Approved

## Problem

During the melding phase, each player's meld declaration produces a separate `melds_declared` log entry. The collapsed game log summary shows only `lastImportantEntry` — the most recent important event — so only the last player's meld declaration is displayed. Users miss the full picture.

**Goal:** When melds from multiple players are the most recent important events, the collapsed summary should display all of them merged, e.g.:

> "Player1 hat keine Meldungen, Player2 meldet 60 Punkte"

Scope: collapsed summary only. The full expanded log continues to show individual entries per player.

## Architecture

The change is confined to three files:

1. `packages/shared-types/src/gameLog.ts` — new type
2. `packages/ui-shared/src/useGameLog.ts` — synthesis logic
3. `apps/client/src/components/ui/GameScreen.tsx` — rendering

## Components

### 1. New `melds_summary` Entry Type (`shared-types`)

Add `'melds_summary'` to the `GameLogEntryType` union type (it is a `type` alias, not an enum) and a new data interface:

```typescript
export interface MeldsSummaryLogData {
  kind: 'melds_summary';
  playerMelds: Array<{ playerIndex: PlayerIndex; totalPoints: number }>;
}
```

Add `MeldsSummaryLogData` to the `GameLogEntryData` union type.

Note: `'melds_summary'` must NOT be added to `IMPORTANT_ENTRY_TYPES` in `useGameLog.ts`. The post-step synthesis logic operates after the `find` call, not by modifying the important-types set.

### 2. `lastImportantEntry` Synthesis (`useGameLog`)

After computing `lastImportantEntry` using the existing logic, add a post-step:

- If `lastImportantEntry` is of type `melds_declared`, find its index in `entries` (the reverse-chronological array)
- Scan from that index toward the end of `entries` (i.e., toward older entries) while the type remains `melds_declared`, collecting all consecutive `melds_declared` entries
- The collected slice is in reverse-chronological order; reverse it to get chronological order before building `playerMelds`
- Synthesize a `GameLogEntry` of type `melds_summary`:
  - `id`: use the `id` of the most recent collected entry (the one at the found index)
  - `timestamp`: use the `timestamp` of the most recent collected entry
  - `playerIndex`: `null` (the summary belongs to no single player)
  - `data.playerMelds`: array of `{ playerIndex, totalPoints }` for each collected entry, in chronological order
- Use this synthetic entry as `lastImportantEntry`

The `entries` array is not modified. Only `lastImportantEntry` changes.

If the most recent important entry is not `melds_declared`, the post-step is a no-op.

### 3. Rendering (`GameScreen.tsx`)

Add a `melds_summary` case to `formatLogEntryText`. For this case, the top-level `name` variable (derived from `entry.playerIndex`) is unused. Instead:

- For each item in `data.playerMelds`, look up the player name via `nicknames.get(item.playerIndex)` and format using the existing `gameLog.meldsDeclared` or `gameLog.meldsNone` i18n keys
- Join the formatted strings with `', '`

No new i18n keys are required.

`melds_summary` must be handled as an explicit case before the `default` branch, which would otherwise silently render it as the raw string `"melds_summary"`. The current `default: return entry.type` branch does not enforce exhaustiveness — TypeScript will not report an error if the case is missing. As part of this change, update the `default` branch to use a never-assertion (e.g. `const _exhaustive: never = d; return ''`) so future omissions are caught at compile time.

## Data Flow

```
MELDS_DECLARED events → entries[] (unchanged, individual entries)
                      ↘
                       lastImportantEntry post-step:
                         collect consecutive melds_declared
                         → synthesize melds_summary entry
                         → lastImportantEntry = melds_summary
                                        ↓
                               collapsedSummary in GameScreen
                               formatLogEntryText(melds_summary)
                               → "P1 hat keine Meldungen, P2 meldet 60 Punkte"
```

## Error Handling

- If only one player has declared melds so far (others not yet), `lastImportantEntry` is a single-item `melds_summary`. This renders identically to the current `melds_declared` behavior — verify as an invariant in tests.
- If no `melds_declared` entries exist, the post-step is a no-op.
- If the most recent important entry is a different type (e.g., `trick_won`), the post-step is a no-op.

## Testing

- **Synthesis — multiple melds**: given a `entries` array where the most recent important entries are 2–3 consecutive `melds_declared` entries, `lastImportantEntry` should be of type `melds_summary` with all players' data in chronological order.
- **Synthesis — single meld**: given a single `melds_declared` as the most recent important entry, `lastImportantEntry` is a single-item `melds_summary` whose formatted string is identical to what `melds_declared` would have produced.
- **Synthesis — no-op**: given a `trick_won` as the most recent important entry (with `melds_declared` entries deeper in the array), `lastImportantEntry` remains `trick_won` and the post-step does not activate.
- **Rendering**: `melds_summary` with mixed zero/nonzero `totalPoints` renders the correct joined string using existing i18n keys.
- Existing tests for individual `melds_declared` entries in `entries[]` continue to pass unchanged.
