# REST API

This document describes the HTTP API for session management.

**Base URL:** `http://localhost:3000` (or your deployed server URL)

## Endpoints

### Health Check

```
GET /health
```

Returns server status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-23T12:00:00.000Z"
}
```

---

### Version

```
GET /version
```

Returns the current server version. Used by clients to detect when a major update is required.

**Response:**

```json
{
  "version": "1.0.0"
}
```

---

### Create Session

```
POST /sessions
```

Create a new game session.

**Request Body:**

| Field         | Type     | Required | Description                  |
| ------------- | -------- | -------- | ---------------------------- |
| `playerCount` | `number` | Yes      | Number of players (2, 3, 4)  |
| `nickname`    | `string` | Yes      | Host player's nickname       |
| `targetScore` | `number` | No       | Score to win (default: 1000) |

**Example Request:**

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"playerCount": 4, "nickname": "Hans"}'
```

**Success Response (201):**

```json
{
  "sessionCode": "schnell-fuchs-42",
  "sessionId": "uuid-here",
  "playerId": "player-uuid",
  "secretId": "secret-uuid",
  "playerIndex": 0
}
```

**Error Responses:**

| Status | Code                   | Description              |
| ------ | ---------------------- | ------------------------ |
| 400    | `INVALID_PLAYER_COUNT` | Player count not 2, 3, 4 |
| 400    | `NICKNAME_REQUIRED`    | Nickname not provided    |
| 500    | `INTERNAL_ERROR`       | Server error             |

---

### Get Session Info

```
GET /sessions/:code
```

Get information about a session.

**URL Parameters:**

| Parameter | Description                             |
| --------- | --------------------------------------- |
| `code`    | Session code (e.g., `schnell-fuchs-42`) |

**Example Request:**

```bash
curl http://localhost:3000/sessions/schnell-fuchs-42
```

**Success Response (200):**

```json
{
  "sessionId": "uuid-here",
  "sessionCode": "schnell-fuchs-42",
  "playerCount": 4,
  "status": "waiting",
  "targetScore": 1000,
  "players": [
    {
      "nickname": "Hans",
      "playerIndex": 0,
      "team": null,
      "connected": true,
      "isAI": false
    },
    {
      "nickname": "Maria",
      "playerIndex": 1,
      "team": null,
      "connected": true,
      "isAI": false
    }
  ],
  "createdAt": "2024-01-23T12:00:00.000Z"
}
```

**Session Status Values:**

| Status       | Description                       |
| ------------ | --------------------------------- |
| `waiting`    | Waiting for players               |
| `active`     | Game in progress                  |
| `finished`   | Game completed                    |
| `terminated` | Session terminated (debug export) |

**Error Responses:**

| Status | Code                | Description       |
| ------ | ------------------- | ----------------- |
| 404    | `SESSION_NOT_FOUND` | Session not found |
| 500    | `INTERNAL_ERROR`    | Server error      |

---

### Join Session

```
POST /sessions/:code/join
```

Join an existing session.

**URL Parameters:**

| Parameter | Description  |
| --------- | ------------ |
| `code`    | Session code |

**Request Body:**

| Field      | Type     | Required | Description     |
| ---------- | -------- | -------- | --------------- |
| `nickname` | `string` | Yes      | Player nickname |

**Example Request:**

```bash
curl -X POST http://localhost:3000/sessions/schnell-fuchs-42/join \
  -H "Content-Type: application/json" \
  -d '{"nickname": "Maria"}'
```

**Success Response (201):**

```json
{
  "sessionId": "uuid-here",
  "playerId": "player-uuid",
  "secretId": "secret-uuid",
  "playerIndex": 1,
  "team": null
}
```

**Important:** Store the `secretId` securely. It's required for:

- Socket.IO authentication
- Reconnecting to the session

**Error Responses:**

| Status | Code                | Description           |
| ------ | ------------------- | --------------------- |
| 400    | `NICKNAME_REQUIRED` | Nickname not provided |
| 404    | `SESSION_NOT_FOUND` | Session not found     |
| 409    | `GAME_STARTED`      | Game already started  |
| 409    | `SESSION_FULL`      | All slots are taken   |
| 500    | `INTERNAL_ERROR`    | Server error          |

---

### Reconnect to Session

```
POST /sessions/:code/reconnect
```

Reconnect to a session after disconnection.

**URL Parameters:**

| Parameter | Description  |
| --------- | ------------ |
| `code`    | Session code |

**Request Body:**

| Field      | Type     | Required | Description                |
| ---------- | -------- | -------- | -------------------------- |
| `secretId` | `string` | Yes      | Secret ID from join/create |

**Example Request:**

```bash
curl -X POST http://localhost:3000/sessions/schnell-fuchs-42/reconnect \
  -H "Content-Type: application/json" \
  -d '{"secretId": "secret-uuid"}'
```

**Success Response (200):**

```json
{
  "playerId": "player-uuid",
  "playerIndex": 0,
  "lastEventSequence": 42
}
```

Use `lastEventSequence` to request missed events via Socket.IO.

**Error Responses:**

| Status | Code                 | Description            |
| ------ | -------------------- | ---------------------- |
| 400    | `SECRET_ID_REQUIRED` | Secret ID not provided |
| 401    | `INVALID_SECRET`     | Secret ID not valid    |
| 404    | `SESSION_NOT_FOUND`  | Session not found      |
| 500    | `INTERNAL_ERROR`     | Server error           |

---

### Export Game Events

```
GET /sessions/:code/events/export
```

Export all game events in human-readable text format for debugging and bug reporting.

**⚠️ Warning:** This endpoint reveals ALL cards (bypassing anti-cheat) and **terminates the session** to prevent cheating. All connected players will be disconnected.

**URL Parameters:**

| Parameter | Description  |
| --------- | ------------ |
| `code`    | Session code |

**Example Request:**

```bash
curl http://localhost:3000/sessions/schnell-fuchs-42/events/export \
  -o game-log.txt
```

**Success Response (200):**

Returns a plain text file (`Content-Type: text/plain`) with the event log:

```
================================================================================
DABB GAME EVENT LOG
================================================================================
⚠️  SESSION TERMINATED AFTER EXPORT

Session: schnell-fuchs-42 (uuid-here)
Export Time: 2024-01-23T12:00:00.000Z
Total Events: 47

PLAYERS:
  [0] Hans (Team 0)
  [1] Maria (Team 1)

================================================================================
ROUND 1 - Dealer: Hans [0]
================================================================================

--- DEALING ---
[001] 12:00:00 | CARDS_DEALT
      Player 0: Herz Ass, Kreuz König, Bollen Ober, ...
      Player 1: Schippe Zehn, Herz Buabe, ...
      Dabb: Herz Buabe, Bollen König

--- BIDDING ---
[002] 12:00:05 | BID_PLACED
      Maria [1] bid 150

... (more events)

================================================================================
END OF LOG
================================================================================
```

**Error Responses:**

| Status | Code                 | Description                |
| ------ | -------------------- | -------------------------- |
| 404    | `SESSION_NOT_FOUND`  | Session not found          |
| 409    | `SESSION_TERMINATED` | Session already terminated |
| 500    | `INTERNAL_ERROR`     | Server error               |

---

### Add AI Player

```
POST /sessions/:code/ai
```

Add an AI player to a session (host only).

**URL Parameters:**

| Parameter | Description  |
| --------- | ------------ |
| `code`    | Session code |

**Headers:**

| Header        | Description                        |
| ------------- | ---------------------------------- |
| `X-Secret-Id` | Host player's secret ID (required) |

**Example Request:**

```bash
curl -X POST http://localhost:3000/sessions/schnell-fuchs-42/ai \
  -H "X-Secret-Id: host-secret-uuid"
```

**Success Response (201):**

```json
{
  "playerId": "ai-player-uuid",
  "playerIndex": 2,
  "nickname": "Bot Fritz",
  "team": null
}
```

**Error Responses:**

| Status | Code                              | Description            |
| ------ | --------------------------------- | ---------------------- |
| 401    | `SECRET_ID_REQUIRED`              | Secret ID not provided |
| 403    | `NOT_HOST`                        | Only host can add AI   |
| 404    | `SESSION_NOT_FOUND`               | Session not found      |
| 409    | `CANNOT_ADD_AI_WHEN_GAME_STARTED` | Game already started   |
| 409    | `NO_AVAILABLE_SLOTS`              | All slots are taken    |
| 500    | `INTERNAL_ERROR`                  | Server error           |

---

### Remove AI Player

```
DELETE /sessions/:code/ai/:playerIndex
```

Remove an AI player from a session (host only).

**URL Parameters:**

| Parameter     | Description             |
| ------------- | ----------------------- |
| `code`        | Session code            |
| `playerIndex` | AI player's index (0-3) |

**Headers:**

| Header        | Description                        |
| ------------- | ---------------------------------- |
| `X-Secret-Id` | Host player's secret ID (required) |

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/sessions/schnell-fuchs-42/ai/2 \
  -H "X-Secret-Id: host-secret-uuid"
```

**Success Response (204):** No content

**Error Responses:**

| Status | Code                                 | Description             |
| ------ | ------------------------------------ | ----------------------- |
| 400    | `INVALID_PLAYER_INDEX`               | Invalid player index    |
| 401    | `SECRET_ID_REQUIRED`                 | Secret ID not provided  |
| 403    | `NOT_HOST`                           | Only host can remove AI |
| 404    | `SESSION_NOT_FOUND`                  | Session not found       |
| 409    | `CANNOT_REMOVE_AI_WHEN_GAME_STARTED` | Game already started    |
| 409    | `PLAYER_NOT_AI`                      | Player is not an AI     |
| 500    | `INTERNAL_ERROR`                     | Server error            |

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

---

## Authentication Flow

1. **Create or Join Session**
   - Receive `secretId` in response
   - Store securely in client (localStorage, AsyncStorage)

2. **Connect to Socket.IO**

   ```typescript
   const socket = io('http://localhost:3000', {
     auth: {
       secretId: 'your-secret-id',
       sessionId: 'session-id',
     },
   });
   ```

3. **Reconnect After Disconnect**
   - Call `POST /sessions/:code/reconnect` with stored `secretId`
   - Reconnect to Socket.IO with same credentials
   - Use `game:sync` event to catch up on missed events

---

## Type Definitions

See `packages/shared-types/src/api.ts` for TypeScript types.
