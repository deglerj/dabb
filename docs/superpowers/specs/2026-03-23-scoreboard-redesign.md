# Scoreboard Table Redesign

**Date:** 2026-03-23
**Status:** Approved

## Problem

The scoreboard modal table is hard to read for average users. The per-round score breakdown uses cryptic notation (`240m + 70t`) and there is no clear visual indicator when:

- The bid winner met or missed their bid
- The bid winner chose to go out (Abgehen)

## Goal

Make the scoreboard table self-explanatory — a user with no Binokel knowledge should be able to read it without any explanation.

## Design

### Score Breakdown

Replace the `{melds}m + {tricks}t` detail line with icon-labelled values:

```
🃏 240 + 🏆 70
      310
```

- 🃏 = melds (Meldungen) — card combinations scored before tricks
- 🏆 = tricks (Stiche) — points won by taking tricks
- The large number below is the round total

When a player went out (Abgehen), their tricks are always 0 and opponents have 0 tricks too (no tricks were played). This is explained by the badge on the bid column.

### Bid Column Badges

The bid column shows the bidder name and bid amount, followed by a colour-coded pill badge indicating the round outcome:

| Scenario                    | Badge              | Colour |
| --------------------------- | ------------------ | ------ |
| Bid winner met their bid    | `✓ Gebot erfüllt`  | Green  |
| Bid winner missed their bid | `✗ Gebot verfehlt` | Red    |
| Bid winner went out         | `🚪 Abgegangen`    | Amber  |
| In-progress round           | _(no badge)_       | —      |

The badge replaces the existing green-text colour on the total as the primary "met bid" signal (the green total colour can remain as a secondary reinforcement).

### Negative totals

When the bid winner misses their bid or goes out, their round total is negative (they lose their bid amount). This is shown in red, e.g. `−160`.

### In-progress round

The current round row shows dashes for all player scores (unchanged). No badge is shown in the bid column since the outcome is not yet known.

## Data Model Changes

`RoundHistoryEntry` in `packages/shared-types/src/game.ts` needs a new optional field:

```ts
export interface RoundHistoryEntry {
  round: number;
  bidWinner: PlayerIndex | null;
  winningBid: number;
  wentOut: boolean;          // NEW
  scores: Record<...> | null;
}
```

`useRoundHistory` in `packages/ui-shared/src/useRoundHistory.ts` must track the `GOING_OUT` event and set `wentOut: true` on the completed round entry.

## i18n Changes

New translation keys needed in `packages/i18n/src/locales/de.ts` and `en.ts` under the `game` namespace:

| Key              | German           | English      |
| ---------------- | ---------------- | ------------ |
| `game.bidMet`    | `Gebot erfüllt`  | `Bid met`    |
| `game.bidMissed` | `Gebot verfehlt` | `Bid missed` |
| `game.wentOut`   | `Abgegangen`     | `Went out`   |

## Files Changed

| File                                                  | Change                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `packages/shared-types/src/game.ts`                   | Add `wentOut: boolean` to `RoundHistoryEntry`             |
| `packages/ui-shared/src/useRoundHistory.ts`           | Track `GOING_OUT` event, set `wentOut` on completed round |
| `apps/client/src/components/game/ScoreboardModal.tsx` | Replace score detail format, add bid column badges        |
| `packages/i18n/src/locales/de.ts`                     | Add `bidMet`, `bidMissed`, `wentOut` keys                 |
| `packages/i18n/src/locales/en.ts`                     | Add `bidMet`, `bidMissed`, `wentOut` keys                 |

## Out of Scope

- Updating `ScoreboardStrip` (the compact top bar) — the strip shows live round state, not history
- Any changes to the `ROUND_SCORED` event payload
