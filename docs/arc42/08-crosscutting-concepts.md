# 8. Crosscutting Concepts

## 8.1 Event Sourcing

All game state changes are captured as immutable events:

```typescript
interface GameEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}
```

**Benefits:**

- Complete audit trail
- Easy debugging (replay events)
- Reliable state reconstruction
- Support for reconnection

## 8.2 Anti-Cheat / View Filtering

Players must only see their own cards. Events are filtered before sending:

```typescript
function filterEventForPlayer(event: GameEvent, playerIndex: PlayerIndex): GameEvent {
  if (event.type === 'CARDS_DEALT') {
    // Replace other players' cards with hidden placeholders
    return {
      ...event,
      payload: {
        ...event.payload,
        hands: filterHands(event.payload.hands, playerIndex),
      },
    };
  }
  // ... more filtering
}
```

## 8.3 Session Management

Sessions use human-readable codes for easy sharing:

```
Format: {adjective}-{noun}-{number}
Examples: schnell-fuchs-42, blau-adler-7
```

Players authenticate with a `secretId` stored in localStorage/AsyncStorage.

## 8.4 State Synchronization

```
Client                Server
  |                      |
  |-- game:playCard ---->|
  |                      |-- validate
  |                      |-- save event
  |<-- game:events ------|
  |                      |
  |-- (apply events) ----|
```

## 8.5 Type Safety

Shared types ensure consistency:

```typescript
// packages/shared-types
export interface Card { ... }
export interface GameState { ... }
export type GameEvent = ... ;

// Used in server
import type { Card } from '@dabb/shared-types';

// Used in web
import type { Card } from '@dabb/shared-types';
```

## 8.6 In-Memory Simulation

The simulation engine demonstrates a key architectural benefit of separating game logic into pure packages: the same `@dabb/game-logic` functions and `BinokelAIPlayer` class used in the live server can run entirely without infrastructure.

```
Live Server Path:
  Socket.IO → handlers.ts → gameService.ts → game-logic → PostgreSQL

Simulation Path:
  runner.ts → SimulationEngine → game-logic (no DB, no network)
```

Both paths use the identical functions for:

- **State management**: `applyEvent()`, `applyEvents()`
- **Event generation**: `createBidPlacedEvent()`, `createCardPlayedEvent()`, etc.
- **Game rules**: `isBiddingComplete()`, `determineTrickWinner()`, `isValidPlay()`
- **Scoring**: `calculateMeldPoints()`, `calculateTrickPoints()`
- **AI decisions**: `BinokelAIPlayer.decide()`
- **Output formatting**: `formatEventLog()`

This ensures that simulation results faithfully represent real game behavior, making the tool reliable for AI strategy tuning and regression detection.
