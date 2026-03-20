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

`nickname` continues to live in the separate `dabb-nickname` storage key.

### 3. Credential Loading in Routes

Each route:

1. Reads `code` from Expo Router path params (synchronous).
2. In a `useEffect`, calls `storageGet(`dabb-${code}`)` and `storageGet('dabb-nickname')` to retrieve credentials.
3. Renders an `ActivityIndicator` while credentials are loading.
4. If storage returns nothing for `dabb-${code}`, navigates to home (`/`) — this handles direct URL access without a valid session or expired sessions.
5. Once credentials are loaded, renders the actual screen (`WaitingRoomScreen` / `GameScreen`).

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

**WaitingRoom → Game (on GAME_STARTED):**

```ts
router.replace({
  pathname: '/game/[code]',
  params: { code },
});
```

### 5. No Server Changes

The socket auth and REST API are unchanged:

- Socket still receives `code` + `secretId` from `useSocket` — now sourced from storage instead of URL params.
- All REST calls still use `code` in the path and `secretId` in `X-Secret-Id` headers.

## Affected Files

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/client/src/app/waiting-room/[id].tsx`    | Rename + refactor to load from storage                                 |
| `apps/client/src/app/game/[id].tsx`            | Rename + refactor to load from storage                                 |
| `apps/client/src/app/game/[id].native.tsx`     | Rename + refactor to load from storage                                 |
| `apps/client/src/components/ui/HomeScreen.tsx` | Strip params from navigation calls; add `playerCount` to storage write |

## Non-Goals

- No server-side changes.
- No changes to storage key naming (`dabb-${code}`).
- No changes to socket auth protocol.
- No changes to REST API.
