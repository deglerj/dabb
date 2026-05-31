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

Players must only see their own cards. Events are filtered client-side before applying to local state (`filterEventForPlayer` in `packages/game-logic/src/state/views.ts`, called from `useGameState`):

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

> **Note:** In the P2P architecture, all events are stored unfiltered in Firebase RTDB and are technically readable by all session participants. Filtering is a UI-level concern only. Write access is controlled by Firebase security rules (secretHash gating) to prevent forging events.

## 8.3 Session Management

Sessions use human-readable codes for easy sharing:

```
Format: {adjective}-{noun}-{number}
Examples: schnell-fuchs-42, blau-adler-7
```

Players authenticate with a `secretId` stored in localStorage/AsyncStorage.

## 8.4 State Synchronization

```
Client A           Firebase RTDB         Client B
  |                      |                   |
  |-- push event ------->|                   |
  |                      |-- broadcast ----->|
  |<-- event echo -------|                   |
  |                      |                   |
  |-- applyEvent() ------|--- applyEvent() --|
```

All clients subscribe to the same Firebase RTDB path. Any client pushing an event triggers real-time callbacks on all other clients.

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

The simulation engine demonstrates a key architectural benefit of separating game logic into pure packages: the same `@dabb/game-logic` functions and `@dabb/game-ai`'s `BinokelAIPlayer` class used in the live server can run entirely without infrastructure.

```
Live P2P Path:
  gameEventFactory.ts → Firebase RTDB → useFirebaseGame → game-logic

Simulation Path:
  runner.ts → SimulationEngine → game-logic (no network, no Firebase)
```

Both paths use the identical functions for:

- **State management**: `applyEvent()`, `applyEvents()`
- **Event generation**: `createBidPlacedEvent()`, `createCardPlayedEvent()`, etc.
- **Game rules**: `isBiddingComplete()`, `determineTrickWinner()`, `isValidPlay()`
- **Scoring**: `calculateMeldPoints()`, `calculateTrickPoints()`
- **AI decisions**: `BinokelAIPlayer.decide()` (from `@dabb/game-ai`)
- **Output formatting**: `formatEventLog()`

This ensures that simulation results faithfully represent real game behavior, making the tool reliable for AI strategy tuning and regression detection.
