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

### useRoundHistory

Computes round-by-round game history from events for scoreboard display:

```typescript
import { useRoundHistory } from '@dabb/ui-shared';

const { rounds, currentRound, gameWinner } = useRoundHistory(events);

// rounds: Array of completed rounds with scores
rounds.forEach((round) => {
  console.log(`Round ${round.round}:`);
  console.log(`  Bid winner: ${round.bidWinner} with ${round.winningBid}`);
  if (round.scores) {
    Object.entries(round.scores).forEach(([player, score]) => {
      console.log(`  ${player}: ${score.melds} melds + ${score.tricks} tricks = ${score.total}`);
      if (!score.bidMet) console.log('    (bid not met!)');
    });
  }
});

// currentRound: Info about the round in progress (if any)
if (currentRound) {
  console.log(`Current: Round ${currentRound.round}, bid: ${currentRound.winningBid}`);
}

// gameWinner: Player/team index when game is finished
if (gameWinner !== null) {
  console.log(`Winner: ${gameWinner}`);
}
```

### useSessionCredentials

Persists session credentials in local storage for reconnection:

```typescript
import { useSessionCredentials } from '@dabb/ui-shared';

const { credentials, saveCredentials, clearCredentials, hasCredentials } =
  useSessionCredentials('session-code');

// Save credentials after joining
saveCredentials({
  secretId: 'abc',
  playerId: 'player-xyz',
  playerIndex: 0,
  sessionId: 'session-id', // optional
});

// Access stored credentials for reconnection
if (hasCredentials) {
  connectToGame(credentials.secretId, credentials.sessionId);
}

// Clear on logout
clearCredentials();
```

## Peer Dependencies

- `react` >= 18.0.0
