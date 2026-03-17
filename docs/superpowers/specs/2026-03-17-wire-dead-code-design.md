# Wire Dead Code & Fix Scoreboard — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Overview

Several implemented features exist in the codebase but are never called: `useRoundHistory`, `useCelebration`, `useVersionCheck`, `useTurnNotification`, and `sounds.ts`. Additionally, `handleRoundScored` in the reducer silently drops `roundScores`, breaking the scoreboard strip. This spec covers wiring everything up and removing the remaining dead exports.

---

## 1. Reducer Fix — `roundScores`

**File:** `packages/game-logic/src/state/reducer.ts`

`handleRoundScored` currently ignores `event.payload.scores` and never sets `state.roundScores`. Fix: populate `roundScores` from `event.payload.scores` for **all keys** (both `PlayerIndex` and `Team`) — same pattern as how `totalScores` is populated. Strip `bidMet` when storing since `RoundScore` only has `melds`, `tricks`, `total` (not `bidMet`). `roundScores` is already reset to an empty Map at round start.

Add a regression test in `packages/game-logic/src/__tests__/`.

**Commit:** `fix(game-logic): populate roundScores in ROUND_SCORED reducer`

---

## 2. Scoreboard History Modal

**New file:** `apps/client/src/components/game/ScoreboardModal.tsx`
**Modified:** `apps/client/src/components/game/ScoreboardStrip.tsx`, `apps/client/src/components/ui/GameScreen.tsx`

- `ScoreboardStrip` wrapped in `TouchableOpacity` — tap opens the modal. The `TouchableOpacity` wrapper must have a stable minimum height so the scoreboard area does not cause a layout shift when `roundScores` is empty (per CLAUDE.md rule 2: never conditionally mount/unmount layout-affecting sections).
- `GameScreen` calls `useRoundHistory(events)` from `@dabb/ui-shared`. Passes `rounds`, `currentRound`, `gameWinner`, `nicknames: Map<PlayerIndex, string>`, and `playerCount` to `ScoreboardModal`.
- `ScoreboardModal`: React Native `Modal` overlay. Shows a table with columns: Round #, Bid Winner, per-player (Melds / Tricks / Total), Bid Met. Current in-progress round row shows available data with dashes for unscored columns. Cumulative totals row at bottom. Dismissible by tapping outside or a close button.

**Commit:** `feat(client): add tappable scoreboard history modal`

---

## 3. Celebration with Skia Animations

**Modified:** `apps/client/src/components/game/CelebrationLayer.tsx`, `apps/client/src/components/ui/GameScreen.tsx`

- `CelebrationLayer` props interface changes: remove `visible: boolean` and `message: string`; add `showConfetti: boolean` and `showFireworks: boolean`.
- `GameScreen` replaces `showCelebration = state.phase === 'scoring'` with `useCelebration(events, playerIndex)` from `@dabb/ui-shared`. Passes `showConfetti` and `showFireworks` to `CelebrationLayer`.
- `CelebrationLayer` gains a Skia `<Canvas>` overlay (full-screen, `pointerEvents="none"`):
  - **Confetti:** ~60 colored rectangles, random initial velocities, gravity, rotation. Animated via Reanimated `useFrameCallback`. Auto-clears after 3 s. Text: "You won the round!"
  - **Fireworks:** 3 burst origins, particles expand outward with opacity fade. Text: "You won the game!"
- Particles are initialized when `showConfetti`/`showFireworks` first transitions to `true`.

**Commit:** `feat(client): wire useCelebration with Skia particle animations`

---

## 4. Version Check Gate

**Modified:** `apps/client/src/app/_layout.tsx`

- Import `useVersionCheck` from `@dabb/ui-shared`, `APP_VERSION` and `SERVER_URL` from `../constants` (note: one level up, not two).
- Call `useVersionCheck({ currentVersion: APP_VERSION, serverBaseUrl: SERVER_URL })` in `RootLayout`.
- Extend the **existing** `if (!fontsLoaded) return null` guard to also return `null` while `isLoading` — do not add a second conditional render path (avoids a CLAUDE.md-violating conditional mount of `<Stack>`).
- After the combined guard: when `needsUpdate`, render `<UpdateRequiredScreen />` instead of `<Stack>`.

**Commit:** `feat(client): wire useVersionCheck to gate app on startup`

---

## 5. Turn Notification Sound

**Modified:** `apps/client/src/components/ui/GameScreen.tsx`

- Import and call `useTurnNotification(state, playerIndex)` alongside existing hooks.
- No new UI — the hook internally uses `useActionRequiredCallback` and plays `notification.ogg` via `expo-audio`.

**Commit:** `feat(client): wire useTurnNotification in GameScreen`

---

## 6. Game Sound Effects

**Modified:** `apps/client/src/app/_layout.tsx`, `apps/client/src/components/ui/GameScreen.tsx`, `apps/client/src/components/game/PlayerHand.tsx`

- `_layout.tsx`: call `loadSoundPreferences()` once in a `useEffect` on mount (import from `../utils/sounds`).
- `GameScreen`: `useEffect` watching `events.length`. Use a `useRef` initialized to `events.length` at mount (not `0`, to avoid replaying sounds on reconnect) to track the last processed index. On each new event, call `playSound` based on event type:
  - `CARDS_DEALT` → `card-deal`
  - `CARD_PLAYED` → `card-play`
  - `BID_PLACED` → `bid-place`
  - `PLAYER_PASSED` → `pass`
  - `TRICK_WON` → `trick-win`
  - `GAME_FINISHED` → `game-win`
- `PlayerHand`: call `playSound('card-select')` when the local player taps a card.

**Commit:** `feat(client): wire game sound effects`

---

## 7. Remove Dead Exports

**Modified:** `packages/ui-shared/src/index.ts`
**Deleted:** `packages/ui-shared/src/useLocalStorage.ts`

- Remove `useSessionCredentials` export from `index.ts`. Delete `useLocalStorage.ts` entirely (it exports only `useSessionCredentials` — nothing else remains).
- Remove `useActionRequired` from the public `index.ts` export (keep it in `useActionRequired.ts` — it's used internally by `useActionRequiredCallback`). Also remove the `ActionRequiredResult` type export since it only exists to support the removed public export.

**Commit:** `refactor(ui-shared): remove unused dead exports`

---

## Commit Order

1. `fix(game-logic): populate roundScores in ROUND_SCORED reducer`
2. `feat(client): add tappable scoreboard history modal`
3. `feat(client): wire useCelebration with Skia particle animations`
4. `feat(client): wire useVersionCheck to gate app on startup`
5. `feat(client): wire useTurnNotification in GameScreen`
6. `feat(client): wire game sound effects`
7. `refactor(ui-shared): remove unused dead exports`
