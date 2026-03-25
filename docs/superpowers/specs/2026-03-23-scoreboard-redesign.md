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

**Going-out rounds:** When the bid winner went out, no tricks were played so tricks are always 0 for all players. To avoid a confusing `🏆 0` for every player, the tricks portion of the detail line is omitted entirely in going-out rounds. Only the melds portion is shown (`🃏 X`). The bid column badge explains why tricks are absent.

**Zero-score fix:** The existing component guards the score display with `if (score)`, which suppresses display for players with all-zero scores (e.g. a going-out bid winner with `{ melds: 0, tricks: 0, total: 0 }`). This must be fixed to `if (score != null)` so zero-score rows render their values correctly.

### Bid Column Badges

The bid column shows the bidder name and bid amount, followed by a colour-coded pill badge indicating the round outcome. The ✓ and ✗ characters are plain Unicode symbols; `🚪` is an emoji. The symbols are hardcoded in the component; only the text label comes from i18n.

| Scenario                    | Badge              | Colour                       |
| --------------------------- | ------------------ | ---------------------------- |
| Bid winner met their bid    | `✓ Gebot erfüllt`  | Green `#6bcb77` on `#1a3d22` |
| Bid winner missed their bid | `✗ Gebot verfehlt` | Red `#e05555` on `#3d1a1a`   |
| Bid winner went out         | `🚪 Abgegangen`    | Amber `#c97f00` on `#3d2a00` |
| In-progress round           | _(no badge)_       | —                            |

The badge is the primary "met bid" signal. Render it as a `View` containing a `Text`, styled as a pill: `borderRadius: 8`, `paddingHorizontal: 6`, `paddingVertical: 2`, `fontSize: 10`.

The badge also appears on the **in-progress row** when `currentRound.wentOut === true`. This is only possible when `currentRound.bidWinner` is non-null (the going-out decision requires a bid winner), so no null guard is needed beyond what already exists.

### Score total colours

- Bid winner, bid met: green `#6bcb77` — apply when `playerIndex === round.bidWinner && score.bidMet`
- Any player, negative total: red `#e05555` — apply when `score.total < 0`
- All other players: white `#f2e8d0` (existing default)

The negative-total condition effectively only fires for the bid winner (non-bid-winners always have non-negative totals), but checking `score.total < 0` is simpler and more correct than checking `playerIndex === bidWinner`.

**`bidMet` colouring for opponents in going-out rounds:** The server may set `bidMet: true` on opponents in going-out rounds (they receive their melds + bonus without a bid to fail). The green colour must only apply when `playerIndex === round.bidWinner && score.bidMet` — not for all players where `bidMet` is true.

### Negative totals

The server already stores a negative `total` in `ROUND_SCORED` when the bid winner misses or goes out. The component displays the value as-is. No negation logic is needed in the UI.

### In-progress round

The current round row shows dashes for all player scores (unchanged). The bid column shows the going-out badge if `currentRound.wentOut === true`, otherwise no badge.

### Team mode (4 players)

In 4-player games, `ROUND_SCORED` scores are keyed by `Team` rather than `PlayerIndex`. The scoreboard already has this as a pre-existing gap. This redesign does not change that behaviour.

## Data Model Changes

### `RoundHistoryEntry`

`wentOut` is added as an **optional** boolean to `RoundHistoryEntry` in `packages/shared-types/src/game.ts`:

```ts
export interface RoundHistoryEntry {
  round: number;
  bidWinner: PlayerIndex | null;
  winningBid: number;
  wentOut?: boolean;   // true when bid winner went out; absent/undefined otherwise
  scores: Record<...> | null;
}
```

Making it optional avoids a breaking change and keeps the `ROUND_SCORED` construction path unchanged for normal rounds.

### `RoundHistoryResult` (currentRound)

`currentRound` in `RoundHistoryResult` (in `useRoundHistory.ts`) must also carry `wentOut`:

```ts
currentRound: {
  round: number;
  bidWinner: PlayerIndex | null;
  winningBid: number;
  wentOut?: boolean;   // NEW — true when bid winner has already gone out this round
  meldScores: Record<PlayerIndex, number> | null;
} | null;
```

### `useRoundHistory` hook implementation

The hook is a pure `useMemo` computation using `let` variables. Add `let wentOut = false` alongside the existing accumulators. Changes:

- **`NEW_ROUND_STARTED`**: add `wentOut = false` (aligned with how other accumulators reset — `GAME_STARTED` does not reset accumulators in the existing hook, so don't add a reset there either)
- **`GOING_OUT`** (new case): set `wentOut = true`
- **`ROUND_SCORED`**: use `...(wentOut ? { wentOut } : {})` in the pushed `RoundHistoryEntry`. Do NOT reset `wentOut` here — it will be cleared by the next `NEW_ROUND_STARTED`, matching the pattern of `bidWinner` and `winningBid`.
- **`currentRound` construction** (first branch only, where `bidWinner !== null`): include `...(wentOut ? { wentOut } : {})`. The second branch (`bidWinner === null` fallback) does not include `wentOut` since going out is impossible without a bid winner.

### i18n

The existing key `game.bidNotMet` exists in locale files and `TranslationKeys` but is not consumed by any component. It is left as-is (dead code — out of scope to remove).

New keys in `packages/i18n/src/locales/de.ts` and `en.ts` under the `game` namespace:

| Key              | German           | English      |
| ---------------- | ---------------- | ------------ |
| `game.bidMet`    | `Gebot erfüllt`  | `Bid met`    |
| `game.bidMissed` | `Gebot verfehlt` | `Bid missed` |
| `game.wentOut`   | `Abgegangen`     | `Went out`   |

`packages/i18n/src/types.ts` must also be updated to add these three keys to the `TranslationKeys` interface.

## StyleSheet changes in `ScoreboardModal`

New styles to add to the existing `StyleSheet.create({...})`:

```ts
badge: {
  borderRadius: 8,
  paddingHorizontal: 6,
  paddingVertical: 2,
},
badgeText: {
  fontSize: 10,
  fontWeight: 'bold',
},
bidMetBadge: {
  backgroundColor: '#1a3d22',  // text colour: #6bcb77
},
bidMissedBadge: {
  backgroundColor: '#3d1a1a',  // text colour: #e05555
},
wentOutBadge: {
  backgroundColor: '#3d2a00',  // text colour: #c97f00
},
scoreTotalNegative: {
  color: '#e05555',  // overrides scoreTotal colour only; apply as [styles.scoreTotal, styles.scoreTotalNegative]
},
```

Usage pattern: `<View style={[styles.badge, styles.bidMetBadge]}><Text style={[styles.badgeText, { color: '#6bcb77' }]}>...</Text></View>`. The `scoreTotal` base style is always applied; `scoreTotalNegative` is conditionally spread when `score.total < 0`.

The existing `bidMet` style in `StyleSheet` applies `color: '#6bcb77'` to `scoreTotal`. Its usage is narrowed: only apply it when `playerIndex === round.bidWinner && score.bidMet`.

## Files Changed

| File                                                  | Change                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared-types/src/game.ts`                   | Add `wentOut?: boolean` to `RoundHistoryEntry`                                                                                                                                                                                                                                |
| `packages/ui-shared/src/useRoundHistory.ts`           | Add `wentOut` to `RoundHistoryResult.currentRound` type; add `let wentOut = false`; handle `GOING_OUT`; reset in `NEW_ROUND_STARTED`; include in completed round and currentRound (first branch only)                                                                         |
| `apps/client/src/components/game/ScoreboardModal.tsx` | Fix `if (score)` → `if (score != null)`; replace score detail format; suppress tricks line in going-out rounds; add bid column badges with going-out badge on in-progress row; apply red colour for negative totals; narrow `bidMet` green to bid winner only; add new styles |
| `packages/i18n/src/locales/de.ts`                     | Add `bidMet`, `bidMissed`, `wentOut` keys                                                                                                                                                                                                                                     |
| `packages/i18n/src/locales/en.ts`                     | Add `bidMet`, `bidMissed`, `wentOut` keys                                                                                                                                                                                                                                     |
| `packages/i18n/src/types.ts`                          | Add `bidMet`, `bidMissed`, `wentOut` to `TranslationKeys` interface                                                                                                                                                                                                           |

## Out of Scope

- Updating `ScoreboardStrip` (the compact top bar)
- Extending the `ROUND_SCORED` event payload with `wentOut`
- Fixing the pre-existing 4-player team mode score display gap
- Removing the dead `game.bidNotMet` i18n key
