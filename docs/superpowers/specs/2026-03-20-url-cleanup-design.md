# Design: Clean Up Game Session URLs

**Date:** 2026-03-20
**Status:** Approved

## Problem

Game session URLs expose sensitive data and carry redundant identifiers:

```
/waiting-room/3f2a1c...?code=ABCD&secretId=a7b3...&playerIndex=0&playerCount=3&nickname=Alice
/game/3f2a1c...?code=ABCD&secretId=a7b3...&playerIndex=0
```

Issues:

- `secretId` is a player auth token. It must not appear in the browser address bar, browser history, or server access logs.
- `id` (UUID) is never used by any server call — all REST and socket auth uses `code`. It is dead weight.
- `playerIndex` is derived from `secretId` server-side; surfacing it in the URL adds noise without benefit.
- `nickname` and `playerCount` are implementation details that pollute the URL.

All credentials are already persisted in storage (`dabb-${code}` → `{secretId, playerId, playerIndex}`), so the URL params are pure redundancy.

## Goal

Reduce the URLs to the minimum meaningful identifier:

```
/waiting-room/ABCD
/game/ABCD
```

## Design

### 1. Route Renaming

| Old file                                    | New file                  |
| ------------------------------------------- | ------------------------- |
| `apps/client/src/app/waiting-room/[id].tsx` | `waiting-room/[code].tsx` |
| `apps/client/src/app/game/[id].tsx`         | `game/[code].tsx`         |
| `apps/client/src/app/game/[id].native.tsx`  | `game/[code].native.tsx`  |

The URL path structure is unchanged (`/waiting-room/ABCD`, `/game/ABCD`). Only the captured param name changes from `id` to `code`.

### 2. Storage Shape

Current `dabb-${code}` entry:

```ts
{
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
}
```

Updated entry (adds `playerCount` for host):

```ts
{ secretId: string; playerId: string; playerIndex: PlayerIndex; playerCount?: number }
```

- **Host**: stores `playerCount` (they selected it during session creation).
- **Joiner**: omits `playerCount` (unknown; WaitingRoomScreen already handles `0` gracefully).

`playerId` is carried through unchanged; it is stored for potential future use and to avoid breaking the shape.

`nickname` continues to live in the separate `dabb-nickname` storage key.

**Code normalisation:** The storage key `dabb-${code}` must use the same normalised form as the URL param: `joinCode.trim().toUpperCase()` for joiners, `sessionData.sessionCode` (already normalised by the server) for hosts. The route reads `code` directly from the path param — the path param is the canonical key.

### 3. Credential Loading in Routes

Each route reads `code` from path params (synchronous), then asynchronously loads credentials.

**Types used in storage:**

```ts
type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
  playerCount?: number; // only written by host
};
```

**`code` vs credentials:** `code` is always available synchronously from the path param. Only `{secretId, playerIndex, playerCount}` need async loading from storage. Keep this distinction throughout — `code` never needs to wait.

**Shared loading pattern:**

1. On mount, if `code` is missing or empty (e.g., direct navigation to `/game/` with no segment), navigate immediately to `/`.
2. Call `storageGet(`dabb-${code}`)` and `storageGet('dabb-nickname')` in parallel.
3. Render an `ActivityIndicator` while credentials are loading. The guard condition is: `if (!credentials) return <ActivityIndicator />`. For waiting-room: add this guard. For game routes: replace the existing `if (!sessionId || !secretId) return null` guard with this.
4. If `dabb-${code}` resolves to `null` or the storage read throws, navigate to `/`. Treat errors and null the same. Socket errors are handled separately; this redirect is storage-only.
5. Store loaded credentials in component state and render the target screen.

**Hook rules compliance:** `useSocket` and other hooks must still be called unconditionally. Pass `sessionCode: code` (from path param, always available) and `secretId: credentials?.secretId ?? ''` while loading. `useSocket` will not attempt a connection with an empty `secretId`. Once credentials load, state updates re-render with real values and the socket connects.

**WaitingRoom-specific:**

- `WaitingRoomScreen` receives `sessionCode={code}` directly from the path param (no async wait needed).
- Own player seeding: call `setPlayers(new Map([[playerIndex, { nickname, connected: true, isAI: false }]]))` inside the storage `useEffect` after credentials load — not in a `useState` lazy initializer, since credentials are unavailable at first render.
- `handleEvents` (which navigates to `/game/[code]` on `GAME_STARTED`) closes over `code` from the path param — always synchronously available, no stale closure issue.
- `handleLeave` calls `storageDelete(`dabb-${code}`)` using `code` from path param. This is unchanged in behaviour and must be preserved.
- `handleAddAI` / `handleRemoveAI` use `secretId` from loaded credentials state.

**Game-specific:** `GameScreen` and `WithSkiaWeb componentProps` require:

- `sessionId` — pass `code` (the 4-letter path param, **not** any UUID). This is the socket auth identifier.
- `secretId` — from loaded `StoredSession.secretId`.
- `playerIndex` — from loaded `StoredSession.playerIndex`.

### 4. Navigation Changes

**HomeScreen → WaitingRoom (create):**

```ts
router.push({
  pathname: '/waiting-room/[code]',
  params: { code: sessionData.sessionCode },
});
```

**HomeScreen → WaitingRoom (join):**

```ts
router.push({
  pathname: '/waiting-room/[code]',
  params: { code: joinCode.trim().toUpperCase() },
});
```

The `joinCode.trim().toUpperCase()` normalisation must match the storage key written just before this navigation call.

**WaitingRoom → Game (on GAME_STARTED):**

```ts
router.replace({
  pathname: '/game/[code]',
  params: { code },
});
```

No credentials in any of these navigation calls.

### 5. No Server Changes

The socket auth and REST API are unchanged:

- Socket still receives `code` + `secretId` from `useSocket` — now sourced from storage instead of URL params.
- All REST calls still use `code` in the path and `secretId` in `X-Secret-Id` headers.

## Affected Files

| File                                           | Change                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/client/src/app/waiting-room/[id].tsx`    | Rename to `[code].tsx`; load credentials from storage; seed players from storage |
| `apps/client/src/app/game/[id].tsx`            | Rename to `[code].tsx`; load credentials from storage; replace null guard        |
| `apps/client/src/app/game/[id].native.tsx`     | Rename to `[code].native.tsx`; load credentials from storage; replace null guard |
| `apps/client/src/components/ui/HomeScreen.tsx` | Strip params from navigation calls; add `playerCount` to storage write           |

## Non-Goals

- No server-side changes.
- No changes to storage key naming (`dabb-${code}`).
- No changes to socket auth protocol.
- No changes to REST API.
