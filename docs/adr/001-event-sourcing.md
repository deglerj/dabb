# ADR 001: Use Event Sourcing for Game State

## Status

Accepted

## Context

We need to manage game state for a multiplayer card game where:
- Multiple players interact simultaneously
- Players can disconnect and reconnect
- Game state must be consistent across all clients
- Debugging and auditing are important

## Decision

We will use **Event Sourcing** to manage game state:

1. All game actions are stored as immutable events
2. Game state is computed by replaying events through a reducer
3. Events are persisted in PostgreSQL
4. Clients receive filtered events based on their player index

## Consequences

### Positive
- **Reliability**: State can always be reconstructed from events
- **Debugging**: Complete history of what happened
- **Reconnection**: Players can sync by replaying missed events
- **Testability**: Deterministic state from event sequences
- **Anti-cheat**: Events can be filtered per player

### Negative
- **Complexity**: More complex than simple state mutations
- **Storage**: Events accumulate over time
- **Performance**: State must be computed, not just read

## Alternatives Considered

1. **Direct State Mutation**: Simpler but no history, hard to sync
2. **Operational Transform**: Good for collaborative editing, overkill for card games
3. **CRDT**: Complex, better suited for eventually consistent scenarios
