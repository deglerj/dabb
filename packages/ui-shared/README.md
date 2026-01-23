# @dabb/ui-shared

Shared React hooks for the Dabb Binokel card game. Provides socket connection management and game state hooks.

## Installation

```bash
pnpm add @dabb/ui-shared
```

## Hooks

### useSocket

Manages Socket.IO connection with automatic reconnection:

```typescript
import { useSocket } from '@dabb/ui-shared';

const { socket, connected, connecting, error, emit } = useSocket({
  serverUrl: 'http://localhost:3000',
  sessionId: 'abc123',
  secretId: 'secret-xyz',
  onEvents: (events) => processEvents(events),
  onError: (error) => showError(error.message),
  onPlayerJoined: (playerIndex, nickname) => updatePlayers(),
  onPlayerLeft: (playerIndex) => updatePlayers(),
  onPlayerReconnected: (playerIndex) => updatePlayers(),
});

// Emit events
emit?.('game:bid', { amount: 160 });
```

### useGameState

Event-sourced game state management:

```typescript
import { useGameState } from '@dabb/ui-shared';

const { state, events, processEvents, reset } = useGameState({
  playerIndex: 0,
  initialPlayerCount: 4,
});

// Process incoming events
socket.on('game:events', ({ events }) => {
  processEvents(events);
});

// Access current game state
console.log(state.phase, state.currentPlayer);
```

### useSessionCredentials

Persists session credentials in local storage:

```typescript
import { useSessionCredentials } from '@dabb/ui-shared';

const { credentials, setCredentials, clearCredentials, loading } = useSessionCredentials();

// Save credentials after joining
await setCredentials({
  secretId: 'abc',
  sessionId: 'xyz',
  nickname: 'Player1',
});

// Access stored credentials
if (credentials) {
  connectToGame(credentials.secretId, credentials.sessionId);
}
```

## Peer Dependencies

- `react` >= 18.0.0
