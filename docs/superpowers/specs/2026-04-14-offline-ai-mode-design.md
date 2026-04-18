# Offline AI Mode — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Overview

Add an offline "Play vs AI" mode to the Dabb mobile app. One human player competes against AI opponents on-device, with no server connection required. Games are resumable after interruption. The feature is accessed directly from a redesigned home screen.

---

## 1. New Package: `packages/game-ai`

Move `BinokelAIPlayer.ts` and `AIPlayer.ts` from `apps/server/src/ai/` into a new `packages/game-ai` package (`@dabb/game-ai`). The new package also contains `OfflineGameEngine` (see Section 2).

**Dependencies:**

- `@dabb/shared-types` — types and constants
- `@dabb/game-logic` — pure game functions

No Node builtins; Metro-bundler-safe. Both `apps/server` and `apps/client` add `@dabb/game-ai` as a dependency. The server's import paths update; no server behaviour changes.

---

## 2. `OfflineGameEngine`

Plain TypeScript class in `packages/game-ai/src/OfflineGameEngine.ts`. No React, no network, no DB.

**Constructor:**

```ts
new OfflineGameEngine({
  playerCount: 2 | 3 | 4,
  difficulty: 'easy' | 'medium' | 'hard',
  humanPlayerIndex: PlayerIndex,   // always 0
  existingEvents?: GameEvent[],    // provided on resume
})
```

**Responsibilities:**

- Owns authoritative `GameState` (full, unfiltered — no anti-cheat needed locally)
- Maintains event log (`GameEvent[]`) for persistence and replay
- `dispatch(action)`: accepts a human player action, applies resulting events, then drives all AI players until it's the human's turn again
- `getViewForPlayer(playerIndex)`: applies `views.ts` filtering so the UI never sees opponent cards
- `onStateChange(state, newEvents)`: callback invoked after each event batch

**AI driving loop:**

```
human dispatches action
  → validate + apply event(s) → onStateChange
  → while nextActingPlayer !== humanPlayerIndex:
      ai.decide(context) → apply event(s) → onStateChange
  → idle, await next human action
```

**Resume:** if `existingEvents` provided, replays them silently to restore state, then resumes from current position.

---

## 3. Shared `GameInterface` + `useOfflineGame` Hook

### `GameInterface`

Extract the return type of `useGame` into an explicit interface in `packages/ui-shared`. Both `useGame` and `useOfflineGame` implement it.

```ts
interface GameInterface {
  state: GameState | null;
  events: GameEvent[];
  nicknames: Record<PlayerIndex, string>;
  connected: boolean;
  onBid(amount: number): void;
  onPass(): void;
  onTakeDabb(): void;
  onDiscard(cardIds: CardId[]): void;
  onGoOut(suit: Suit): void;
  onDeclareTrump(suit: Suit): void;
  onDeclareMelds(melds: Meld[]): void;
  onPlayCard(cardId: CardId): void;
  onExit(): void;
}
```

### `useOfflineGame` Hook

Lives in `packages/ui-shared`. Wraps `OfflineGameEngine`:

- **Mount:** loads persisted event log from AsyncStorage (`dabb-offline-game`); constructs engine with `existingEvents` if found; starts or resumes game
- **State updates:** subscribes to `onStateChange` → calls `getViewForPlayer(humanPlayerIndex)` → updates React state
- **Action handlers:** each calls `engine.dispatch(action)`
- **`onExit`:** clears `dabb-offline-game` from AsyncStorage, tears down engine
- **`nicknames`:** human player uses saved nickname from `dabb-nickname` storage; AI players use `t('offline.aiPlayerName', { index })` → "KI 1", "KI 2", "KI 3"
- **`connected`:** always `true`

### `GameScreen` change

`GameScreen` accepts a `game: GameInterface` prop instead of constructing `useGame` internally. Online routes pass `useGame(...)`, offline route passes `useOfflineGame(...)`. Confined to one prop extraction.

---

## 4. Home Screen & Navigation

### Home Screen (`HomeScreen.tsx`)

Three top-level buttons replace the current two:

| Button                 | Key                 | Previous equivalent |
| ---------------------- | ------------------- | ------------------- |
| Lokal gegen KI         | `home.playOffline`  | — (new)             |
| Online-Spiel erstellen | `home.createOnline` | Create Game         |
| Online-Spiel beitreten | `home.joinOnline`   | Join Game           |

**Offline setup form** (new `offline` mode within `HomeScreen`):

- Nickname input (reuses `dabb-nickname` storage key)
- Player count selector: 2 / 3 / 4 (same toggle pattern as online create)
- AI difficulty selector: Einfach / Mittel / Schwer (same three-button toggle pattern as waiting room)
- "Spielen" button → navigates to `/game/offline`

**Resume banner:** on mount, `HomeScreen` checks AsyncStorage for `dabb-offline-game`. If found and game is not `finished`/`terminated`, renders a **"Weiterspielen"** button above the three main buttons. Tapping navigates to `/game/offline?resume=true`.

### New Routes

- `apps/client/src/app/game/offline.tsx` (web)
- `apps/client/src/app/game/offline.native.tsx` (mobile)

Reads config from route params (`playerCount`, `difficulty`; `humanPlayerIndex` is always 0). Constructs `useOfflineGame`, passes result to `GameScreen`. No waiting room step.

---

## 5. Persistence

**Storage key:** `dabb-offline-game` in AsyncStorage (already available; app uses v2.2.0).

**Stored payload:**

```ts
{
  config: { playerCount, difficulty, humanPlayerIndex },
  events: GameEvent[],
  phase: GamePhase,   // kept up-to-date on each write; avoids replaying events on HomeScreen
}
```

**Write strategy:** rewrite the full payload after every event (events array + updated phase). Writes are small; a crash loses at most the current action.

**Resume detection:** `HomeScreen` on mount reads `dabb-offline-game`. If `phase` is not `finished` or `terminated`, show "Weiterspielen". No event replay needed at this point.

**Cleanup:** both `onExit` and `GameTerminatedModal`'s "Done" action clear `dabb-offline-game`.

---

## 6. i18n

New keys added to both `packages/i18n/src/locales/de.ts` and `en.ts`:

| Key                        | de                     | en                 |
| -------------------------- | ---------------------- | ------------------ |
| `home.playOffline`         | Lokal gegen KI         | Local vs AI        |
| `home.createOnline`        | Online-Spiel erstellen | Create Online Game |
| `home.joinOnline`          | Online-Spiel beitreten | Join Online Game   |
| `home.resumeGame`          | Weiterspielen          | Resume Game        |
| `offline.difficulty`       | Schwierigkeit          | Difficulty         |
| `offline.difficultyEasy`   | Einfach                | Easy               |
| `offline.difficultyMedium` | Mittel                 | Medium             |
| `offline.difficultyHard`   | Schwer                 | Hard               |
| `offline.startGame`        | Spielen                | Play               |
| `offline.aiPlayerName`     | KI {{index}}           | AI {{index}}       |

All existing keys are untouched.

---

## Architecture Diagram

```
packages/game-ai
  ├── BinokelAIPlayer.ts     (moved from apps/server/src/ai/)
  ├── AIPlayer.ts            (moved from apps/server/src/ai/)
  └── OfflineGameEngine.ts   (new)

packages/ui-shared
  ├── GameInterface.ts       (new — extracted from useGame return type)
  ├── useGame.ts             (updated to implement GameInterface)
  └── useOfflineGame.ts      (new — wraps OfflineGameEngine)

apps/client/src/
  ├── components/ui/HomeScreen.tsx        (updated — 3 buttons + offline form + resume banner)
  └── app/game/
      ├── offline.tsx                     (new web route)
      └── offline.native.tsx              (new mobile route)

apps/server/src/ai/          (now re-exports from @dabb/game-ai)
```

---

## Out of Scope

- Pass-and-play (multiple humans sharing a device)
- Per-opponent difficulty settings
- Offline game history / statistics
- Cloud sync of offline games
