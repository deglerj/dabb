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
  // Online authentication is handled by the Firebase client transport.
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

### Session identity

Online authentication is owned by the client Firebase transport, not this package. The client bootstraps an anonymous Firebase Auth identity with browser-local persistence; RTDB rules bind the authenticated UID to the session seat.

## Peer Dependencies

- `react` >= 18.0.0
