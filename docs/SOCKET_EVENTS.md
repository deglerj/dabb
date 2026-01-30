# Socket.IO Events

This document describes the real-time communication protocol between clients and the server.

## Connection

Connect to the server with authentication:

```typescript
const socket = io('http://localhost:3000', {
  auth: {
    secretId: 'player-secret-id',
    sessionId: 'game-session-id',
  },
});
```

## Client → Server Events

Events sent from the client to the server.

### `game:start`

Start the game (host only).

```typescript
socket.emit('game:start');
```

**Requirements:**

- Must be player index 0 (host)
- All player slots must be filled

---

### `game:bid`

Place a bid during the bidding phase.

```typescript
socket.emit('game:bid', { amount: 160 });
```

**Payload:**

| Field    | Type     | Description                    |
| -------- | -------- | ------------------------------ |
| `amount` | `number` | Bid amount (must beat current) |

**Requirements:**

- Must be current bidder
- Amount must be >= current bid + 10
- Amount must be divisible by 10

---

### `game:pass`

Pass on bidding.

```typescript
socket.emit('game:pass');
```

**Requirements:**

- Must be current bidder

---

### `game:takeDabb`

Take the Dabb cards (bid winner only).

```typescript
socket.emit('game:takeDabb');
```

**Requirements:**

- Must be bid winner
- Game must be in dabb phase

---

### `game:discard`

Discard cards from hand after taking Dabb.

```typescript
socket.emit('game:discard', { cardIds: ['card1', 'card2'] });
```

**Payload:**

| Field     | Type       | Description                                |
| --------- | ---------- | ------------------------------------------ |
| `cardIds` | `string[]` | Card IDs to discard (must match dabb size) |

**Requirements:**

- Must be bid winner
- Number of cards must equal dabb size (4 for 4 players, 5 for 3, 6 for 2)

---

### `game:declareTrump`

Declare the trump suit.

```typescript
socket.emit('game:declareTrump', { suit: 'herz' });
```

**Payload:**

| Field  | Type   | Description                                         |
| ------ | ------ | --------------------------------------------------- |
| `suit` | `Suit` | Trump suit: `kreuz`, `schippe`, `herz`, or `bollen` |

**Requirements:**

- Must be bid winner
- Game must be in trump phase

---

### `game:declareMelds`

Declare melds for scoring.

```typescript
socket.emit('game:declareMelds', {
  melds: [
    { type: 'PAAR', cards: [...], points: 20 },
    { type: 'BINOKEL', cards: [...], points: 40 },
  ],
});
```

**Payload:**

| Field   | Type     | Description           |
| ------- | -------- | --------------------- |
| `melds` | `Meld[]` | Array of meld objects |

**Requirements:**

- Game must be in melding phase
- All cards must be in player's hand

---

### `game:playCard`

Play a card during the tricks phase.

```typescript
socket.emit('game:playCard', { cardId: 'kreuz-ass-1' });
```

**Payload:**

| Field    | Type     | Description     |
| -------- | -------- | --------------- |
| `cardId` | `string` | Card ID to play |

**Requirements:**

- Must be current player's turn
- Card must follow game rules (suit, trump, etc.)

---

### `game:sync`

Request missed events (for reconnection).

```typescript
socket.emit('game:sync', { lastEventSequence: 5 });
```

**Payload:**

| Field               | Type     | Description                    |
| ------------------- | -------- | ------------------------------ |
| `lastEventSequence` | `number` | Last event sequence client has |

---

## Server → Client Events

Events sent from the server to clients.

### `game:state`

Full game state on connection.

```typescript
socket.on('game:state', ({ events }) => {
  // Rebuild game state from all events
  const state = applyEvents(events);
});
```

**Payload:**

| Field    | Type          | Description                                  |
| -------- | ------------- | -------------------------------------------- |
| `events` | `GameEvent[]` | All events (filtered for this player's view) |

---

### `game:events`

New game events.

```typescript
socket.on('game:events', ({ events }) => {
  // Apply new events to current state
  for (const event of events) {
    state = applyEvent(state, event);
  }
});
```

**Payload:**

| Field    | Type          | Description                           |
| -------- | ------------- | ------------------------------------- |
| `events` | `GameEvent[]` | New events (filtered for player view) |

---

### `player:joined`

A player joined the session.

```typescript
socket.on('player:joined', ({ playerIndex, nickname }) => {
  console.log(`${nickname} joined as player ${playerIndex}`);
});
```

**Payload:**

| Field         | Type     | Description           |
| ------------- | -------- | --------------------- |
| `playerIndex` | `number` | Player position (0-3) |
| `nickname`    | `string` | Player display name   |

---

### `player:left`

A player disconnected.

```typescript
socket.on('player:left', ({ playerIndex }) => {
  console.log(`Player ${playerIndex} disconnected`);
});
```

**Payload:**

| Field         | Type     | Description           |
| ------------- | -------- | --------------------- |
| `playerIndex` | `number` | Player position (0-3) |

---

### `player:reconnected`

A player reconnected.

```typescript
socket.on('player:reconnected', ({ playerIndex }) => {
  console.log(`Player ${playerIndex} reconnected`);
});
```

**Payload:**

| Field         | Type     | Description           |
| ------------- | -------- | --------------------- |
| `playerIndex` | `number` | Player position (0-3) |

---

### `session:terminated`

The session was terminated (e.g., due to inactivity or debug export).

```typescript
socket.on('session:terminated', ({ message }) => {
  console.log(`Session ended: ${message}`);
  // Redirect to home or show message
});
```

**Payload:**

| Field     | Type     | Description            |
| --------- | -------- | ---------------------- |
| `message` | `string` | Reason for termination |

**Termination Reasons:**

- Inactivity: Sessions with no activity for 2+ days are automatically terminated
- Debug export: Session terminated after exporting game data for debugging

---

### `error`

An error occurred.

```typescript
socket.on('error', ({ message, code }) => {
  console.error(`Error [${code}]: ${message}`);
});
```

**Payload:**

| Field     | Type     | Description   |
| --------- | -------- | ------------- |
| `message` | `string` | Error message |
| `code`    | `string` | Error code    |

**Error Codes:**

| Code            | Description               |
| --------------- | ------------------------- |
| `SYNC_FAILED`   | Failed to sync game state |
| `INVALID_MOVE`  | Invalid game action       |
| `NOT_YOUR_TURN` | Not player's turn         |

---

## Event Filtering (Anti-Cheat)

Events containing opponent cards are filtered before sending to clients:

- `CARDS_DEALT` - Only shows player's own hand
- `DABB_TAKEN` - Hidden from other players
- `CARDS_DISCARDED` - Hidden from other players

This prevents clients from seeing hidden information.

---

## Type Definitions

See `packages/shared-types/src/socket.ts` for TypeScript type definitions.
