# Firebase P2P Multiplayer Design

**Date:** 2026-04-21  
**Status:** Approved

## Problem

Running a Node.js + PostgreSQL server for a small-user card game is too expensive. Goal: eliminate server costs while keeping multiplayer.

## Chosen Approach

Replace Socket.IO + PostgreSQL + Node.js server with **Firebase Realtime Database**. All clients are equal peers — no server process, no host authority. Game logic packages are unchanged.

## Architecture

```
Client A ──┐
Client B ──┼──► Firebase RTDB ◄──► Client C
Client D ──┘
```

Each client:

- Writes game actions as events directly to Firebase
- Validates incoming events locally using existing `game-logic` validators
- Applies `views.ts` filtering locally (each player sees only their own cards)
- Maintains full event log in local state (enables reconnection by replay)

PHP hosting serves only the static web client. All `packages/` are unchanged.

## Trust Model

**Soft trust** — players trust each other (family/friends game). Full unfiltered event payloads stored in Firebase; each client filters their own view. A determined cheater could read raw Firebase, but this is acceptable for the target audience.

## Firebase Data Structure

```
/sessions/{sessionCode}/
  meta/
    playerCount: 3
    targetScore: 1000
    status: "waiting" | "active" | "finished" | "terminated"
    createdAt: timestamp
    players/
      0/ { nickname: "Hans", secretHash: "sha256...", isAI: false }
      1/ { nickname: "Maria", secretHash: "sha256...", isAI: false }
      2/ { nickname: "Bot Fritz", secretHash: null, isAI: true }
  presence/
    0: { connected: true, lastSeen: timestamp }
    1: { connected: false, lastSeen: timestamp }
  events/
    -Kpush1/ { sequence: 0, type: "GAME_STARTED", authorHash: "sha256...", payload: {...} }
    -Kpush2/ { sequence: 1, type: "CARDS_DEALT", authorHash: "sha256...", payload: { ...unfiltered... } }
  aiClaims/
    "2_seq5": { claimedBy: "sha256...", claimedAt: timestamp }
```

- Events store **full unfiltered payloads** — clients apply `views.ts` locally
- `secretHash` = SHA-256 of player's locally-generated UUID (stored in AsyncStorage)
- Session code generated client-side (adjective-noun-number format, unchanged)
- `presence/` uses Firebase `.onDisconnect()` for automatic offline detection

## Event Flow

### Writing a move

1. Player triggers action (play card, bid, etc.)
2. Client validates against local state using existing `game-logic` validators
3. Invalid → show error toast, stop
4. Valid → `push()` event with `authorHash` to `sessions/{code}/events/`

### Receiving events (all clients including writer)

1. Firebase `on('child_added')` fires for every new event
2. Client runs event through reducer
3. Invalid event (duplicate, wrong turn) → ignore silently, log warning
4. Valid → update local state, re-render

### Reconnection

1. Subscribe to `events/` with `startAt(lastKnownSequence)`
2. Firebase replays missed events
3. Reducer catches up — full state restored

### Race conditions

Firebase `push()` guarantees total ordering — all clients see events in identical sequence. The second of two simultaneous writes is invalid by definition (wrong turn) and every client drops it.

## Security Rules

Only registered players can push events. Prevents strangers injecting moves.

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": "auth == null",
        "meta": {
          "status": { ".write": "auth == null" },
          "playerCount": { ".write": "!data.exists()" },
          "targetScore": { ".write": "!data.exists()" },
          "createdAt": { ".write": "!data.exists()" },
          "players": {
            "$playerIndex": {
              ".write": "!data.exists()"
            }
          }
        },
        "events": {
          "$eventId": {
            ".write": "
              root.child('sessions/' + $code + '/meta/players').forEach(function(p) {
                return p.child('secretHash').val() === newData.child('authorHash').val()
              })
            "
          }
        },
        "presence": {
          "$playerIndex": {
            ".write": "auth == null"
          }
        },
        "aiClaims": {
          "$claimId": {
            ".write": "auth == null"
          }
        }
      }
    }
  }
}
```

## AI Players

1. Client detects AI turn from local state after each event
2. Client attempts Firebase transaction on `aiClaims/{playerIndex}_seq{sequence}`
3. Transaction winner runs `game-ai`, pushes result event
4. Claims older than 10s with no corresponding event are treated as expired

The `game-ai` package is **unchanged**.

## Session Management

| Operation      | Implementation                                                             |
| -------------- | -------------------------------------------------------------------------- |
| Create session | Generate code + secretId client-side, write `meta/` to Firebase            |
| Join session   | Read `meta/` to verify slots available, write own player entry             |
| Reconnect      | Read secretId from AsyncStorage, verify secretHash, subscribe to `events/` |
| Terminate      | Write `meta/status = "terminated"`, all clients navigate home              |

## Migration Scope

| Remove                  | Keep unchanged           | Change                                               |
| ----------------------- | ------------------------ | ---------------------------------------------------- |
| `apps/server/` (entire) | `packages/game-logic/`   | `apps/client/` — replace Socket.IO with Firebase SDK |
| PostgreSQL + Docker     | `packages/game-ai/`      | Session creation/join screens                        |
| `docker-compose.yml`    | `packages/shared-types/` | Remove `apps/server` from Turborepo                  |
| CI deploy steps         | `packages/i18n/`         | Add Firebase config                                  |
|                         | `packages/game-canvas/`  | Update `docs/`                                       |
|                         | `packages/ui-shared/`    |                                                      |
|                         | `packages/card-assets/`  |                                                      |

**New dependency:** `firebase` JS SDK (~50 KB gzipped). Works in Expo Go + web + React Native with no native modules.

## Cost

Firebase Spark (free) plan:

- 100 simultaneous connections
- 10 GB/month download
- 1 GB storage

Estimated usage for a family card game: <5 MB/month. Effectively $0 indefinitely.
