# Design: ScoreboardStrip & Collapsed Game Log Improvements

**Date:** 2026-03-21
**Status:** Approved

## Overview

Two UI improvements to the collapsed game UI:

1. **ScoreboardStrip**: Add highest bid/bidder and current trump; remove the "Ziel" (target score).
2. **Game Log header**: When collapsed, always show the last "important" game event inline.

---

## 1. ScoreboardStrip

### What Changes

The right-hand section of the strip currently shows the target score ("Ziel: 1000"). This is replaced with a two-row block:

- **Row 1** — `Gebot: <nickname> · <amount>` (e.g. "Anna · 180")
- **Row 2** — `Trumpf: <suit symbol + name>` (e.g. "♥ Herz")

Per-player round score and total score columns remain unchanged.

### Empty States

When the bid winner is not yet known (bidding in progress or pre-bidding), show `—` for the bid row. When trump is not yet declared, show `—` for the trump row.

### Props

Remove `targetScore`. Add:

| Prop         | Type                       | Description                    |
| ------------ | -------------------------- | ------------------------------ |
| `bidWinner`  | `PlayerIndex \| null`      | Winner of the auction, or null |
| `highestBid` | `number`                   | The winning bid amount         |
| `trump`      | `Suit \| null`             | Declared trump suit, or null   |
| `nicknames`  | `Map<PlayerIndex, string>` | Player display names           |

All new data is already available in `GameState` and the `nicknames` map in `GameScreen`.

### i18n

Reuse existing keys: `game.bidColumn` ("Gebot") and `game.trump` ("Trumpf"). No new keys needed.

### Suit Display

Use the same `formatSuit` utility already used in game log formatting, to ensure consistent suit rendering across the UI.

---

## 2. Game Log Collapsed Header

### What Changes

When the log is collapsed, the header currently shows only the title and entry count. It will now also show the **last important event** as an italic, truncated string between the count and the toggle arrow.

When no important event has occurred yet, the space is empty (no placeholder text).

### Important Event Types

| Event Type       | Example text                         |
| ---------------- | ------------------------------------ |
| `going_out`      | "Anna geht ab in Herz"               |
| `trick_won`      | "Anna gewinnt den Stich (18 Punkte)" |
| `round_scored`   | "Runde beendet"                      |
| `melds_declared` | "Max meldet 60 Punkte"               |
| `game_finished`  | "Max gewinnt das Spiel!"             |

All other event types (bids, cards played, round started, etc.) are not considered important.

When expanded, the summary is hidden — the header shows only title, count, and toggle icon as before.

### Hook Change: `useGameLog`

Add `lastImportantEntry: GameLogEntry | null` to `GameLogResult`. This is computed by scanning `entries` (already in reverse chronological order) for the first entry whose `type` is one of the five important types.

### Component Change: `GameLogTab`

Add optional prop `collapsedSummary?: string`. When the log is collapsed and this prop is provided, render it inline in the header row with `flex: 1`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, styled as italic muted text.

### GameScreen Wiring

In `GameScreen`, derive the collapsed summary string by applying the existing `formatLogEntryText` function to `lastImportantEntry`. Pass it as `collapsedSummary` to `GameLogTab`.

---

## Files Affected

| File                                                  | Change                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/client/src/components/game/ScoreboardStrip.tsx` | Replace `targetScore` prop with `bidWinner`, `highestBid`, `trump`, `nicknames`; render new right-side block |
| `apps/client/src/components/ui/GameScreen.tsx`        | Pass new props to `ScoreboardStrip`; pass `collapsedSummary` to `GameLogTab`                                 |
| `packages/ui-shared/src/useGameLog.ts`                | Add `lastImportantEntry` to `GameLogResult`                                                                  |
| `apps/client/src/components/game/GameLogTab.tsx`      | Add `collapsedSummary` prop; render inline when collapsed                                                    |

No new files. No i18n changes. No server changes.
