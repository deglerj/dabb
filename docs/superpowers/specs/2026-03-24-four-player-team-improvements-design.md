# Four-Player Team Mode Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

Four changes to improve the 4-player team experience in Dabb:

1. **AI team-aware bidding** — AI should not aggressively outbid its own teammate unless very confident
2. **Team scoreboard** — strip and modal show 2 team columns, not 4 individual players
3. **Teammate name badge** — opponent badge visually distinguishes the local player's teammate
4. **Team win/lose messages** — end-game messages show both team member names

These changes only activate when `playerCount === 4`. All 2-player and 3-player behaviour is unchanged.

---

## 1. AI Team-Aware Bidding

### File

`apps/server/src/ai/BinokelAIPlayer.ts`

### Current behaviour

`decideBidding()` uses a margin-of-safety model: `diff = estimatedTotal - minBid`.

- `diff >= 60` → always bid
- `diff <= -50` → always pass
- middle zone → probabilistic pass (up to 85%)

No team awareness: the AI bids identically whether it is outbidding a teammate or an opponent.

### Change

Before entering the probabilistic middle zone, check whether the current bid leader is the AI's teammate. If so, only bid when `diff >= 60` (treat the entire uncertain zone as a pass).

**How to identify the current bid leader:** `GameState` has `currentBidder: PlayerIndex | null` (the player whose turn it is next) and `bidWinner: PlayerIndex | null` (only set after bidding ends, null during the bidding phase). Neither tracks who last placed a bid during an active bidding phase. Therefore, add a new field:

```typescript
// packages/shared-types/src/game.ts  — add to GameState
lastBidderIndex: PlayerIndex | null;
```

Set it in the reducer's `BID_PLACED` handler alongside existing fields:

```typescript
// packages/game-logic/src/state/reducer.ts — handleBidPlaced
state.lastBidderIndex = event.payload.playerIndex;
```

Reset it to `null` in `handleGameStarted` and `handleNewRoundStarted`.

**Blunder system:** `maybeBlunder()` is **not** applied when the rule "pass because opponent is teammate" fires. An AI should never accidentally overbid its own partner.

**Logic sketch:**

```
const partnerIndex = getPartner(playerIndex, gameState)   // already exists
const biddingAgainstPartner = gameState.lastBidderIndex === partnerIndex

if (biddingAgainstPartner) {
  return diff >= 60
    ? { type: 'bid', amount: minBid }
    : { type: 'pass' }
}
// otherwise: existing logic unchanged
```

---

## 2. Team Scoreboard

### Files

- `apps/client/src/components/game/ScoreboardStrip.tsx`
- `apps/client/src/components/game/ScoreboardModal.tsx`
- `apps/client/src/screens/GameScreen.tsx` (or equivalent parent that passes props)

### New shared prop type

Declare in `packages/shared-types/src/game.ts` (alongside `Team`, `Player`, etc.) so both components can import it without circular dependencies:

```typescript
export interface TeamScoreEntry {
  team: Team;
  names: string; // e.g. "Anna & Bob" — pre-formatted by parent
  score: number;
  isMyTeam: boolean;
}
```

The parent constructs this by grouping `players` by `team` and looking up `totalScores[team]`. It is only constructed when `playerCount === 4`.

### ScoreboardStrip changes

- New optional prop: `teamScores?: TeamScoreEntry[]`
- When present: render 2 coloured score boxes instead of the current `totalScores.map()` loop
  - Local team box: blue background (`#1e3a5f`), blue name label (`#7ab3e0`)
  - Opponent team box: dark red background (`#3a1e1e`), red name label (`#e07a7a`)
- Bid info and trump sections: unchanged

### ScoreboardModal changes

- New optional props: `teamScores?: TeamScoreEntry[]`, `teamsByPlayerIndex?: Map<PlayerIndex, Team>`
  - `teamsByPlayerIndex` is derived by the parent from `players` and passed down so the modal can resolve which team a bid winner belongs to without receiving the full `players` array
- When `teamScores` is present: column headers use `teamScores.map(t => t.names)` instead of `playerIndices.map(name)`
- Round score cells read `round.scores[t.team]` instead of `round.scores[pi]`
- Bid-met highlight: `round.bidWinner` is a `PlayerIndex`; look it up in `teamsByPlayerIndex` to get the winning `Team`, then highlight that team's column
- Totals row: sums `teamScores[t].score`

---

## 3. Teammate Name Badge

### File

`apps/client/src/components/game/OpponentZone.tsx`

### Change

- New optional prop: `isTeammate?: boolean`
- When `true`:
  - Border colour changes from `#c8b090` to `#4a90d9`
  - A 🤝 icon is appended inside the nameplate after the nickname text
- All other styling (background, font, positioning, offline badge) unchanged

### Wiring

The parent component that renders `<OpponentZone>` already has access to `players` (with `.team` fields) and the local player's index. It passes `isTeammate={player.team === myPlayer.team}` for each opponent.

---

## 4. Team Win/Lose Messages

### Files

- `apps/client/src/components/game/GameTerminatedModal.tsx`
- `apps/client/src/components/game/CelebrationLayer.tsx`
- `packages/i18n/src/locales/de.ts`
- `packages/i18n/src/locales/en.ts`

### Winner detection in GameScreen (4-player)

`GameScreen.tsx` currently finds `winnerPlayer` by scanning for a player whose `totalScores.get(playerIndex)` exceeds the target score. In 4-player mode `totalScores` is keyed by `Team`, so this lookup always returns `undefined` — `winnerId` is always `null` and the modal would show `game.gameEnded` instead of a winner message.

Fix: when `playerCount === 4`, determine the winning team by checking `totalScores.get(0 as Team)` and `totalScores.get(1 as Team)` against the target score. Then collect the nicknames of all players on that team to pass as `winnerNicknames`.

### Prop change on GameTerminatedModal

Replace `winnerNickname: string | null` with `winnerNicknames: string[]`.

- 2/3-player: `['Bob']` (single name, existing behaviour)
- 4-player: `['Bob', 'Chris']` (both team members)

The modal formats names inline: `names.join(' & ')` (or locale-appropriate conjunction).

### New i18n keys

| Key                          | German                                    | English                                 |
| ---------------------------- | ----------------------------------------- | --------------------------------------- |
| `game.youAndTeammateWonGame` | `Du und {{name}} habt gewonnen! 🎉`       | `You and {{name}} won the game! 🎉`     |
| `game.playersWonGame`        | `{{name1}} und {{name2}} haben gewonnen.` | `{{name1}} and {{name2}} won the game.` |
| `game.teamWonRound`          | `Dein Team hat die Runde gewonnen! 🎉`    | `Your team won the round! 🎉`           |
| `game.teamWonGame`           | `Dein Team hat gewonnen! 🎉`              | `Your team won the game! 🎉`            |

### Message selection logic (GameTerminatedModal)

```
if terminatedByNickname      → existing key (unchanged)
else if no winner            → existing key (unchanged)
else if isLocalWinner
  4-player                   → game.youAndTeammateWonGame { name: teammateName }
  2/3-player                 → game.youWonGame (unchanged)
else
  4-player                   → game.playersWonGame { name1, name2 }
  2/3-player                 → game.playerWonGame { name } (unchanged)
```

### CelebrationLayer changes

- New optional props: `isTeamGame?: boolean`, `teammateName?: string`
- `CelebrationLayer` is only ever shown to the local player when their side won (controlled by `useCelebration` via `isOnWinningSide` / `playerWon`). The messages are therefore always from the local winner's perspective.
- Round win (confetti): `isTeamGame` → use `game.teamWonRound`; otherwise `game.youWonRound`
- Game win (fireworks): `isTeamGame` → use `game.teamWonGame`; otherwise `game.youWonGame`
  - `game.teamWonGame` (`"Dein Team hat gewonnen! 🎉"`) is used exclusively here. It intentionally omits the teammate name for brevity in the animated overlay; the modal (`GameTerminatedModal`) is where the full team names appear.
- **Important:** Both `isTeamGame` and `teammateName` must be added to the `startAnimation` `useCallback` dependency array (currently `[width, height, stopAnimation, t]`), otherwise the closure captures stale values and the wrong message is shown after props change.

### Game log (gameFinished entry)

The `gameFinished` log entry currently formats `"{{name}} gewinnt das Spiel!"`. For 4-player, the winner is a `Team`, so both member names are joined: `"Anna und Bob gewinnen das Spiel!"`. This is handled in `packages/ui-shared/src/useGameLog.ts` where `gameFinished` entries are formatted — names are interpolated at render time from the players list, not via a new i18n key.

---

## Testing

- **AI bidding**: Add a unit test in `bidding.test.ts` (or a new `teamBidding.test.ts`) that sets up a 4-player game where the AI's teammate holds the current bid — verify the AI passes even when `diff` is in the uncertain zone. Also verify it still bids when `diff >= 60`.
- **Scoreboard**: Visual regression is sufficient (no new unit tests needed for pure display components).
- **Badge**: No test needed (pure style prop).
- **Messages**: No new unit tests needed; covered by i18n key existence.

---

## Out of Scope

- Changing team assignment logic (remains random)
- Showing individual player contribution within a team round (teams show aggregate only)
- Any changes to 2-player or 3-player modes
