# ADR 003: Socket.IO for Real-time Communication

## Status

Accepted

## Context

The game requires real-time bidirectional communication between server and clients for:
- Game event broadcasting
- Player join/leave notifications
- Reconnection handling

## Decision

We will use **Socket.IO** for real-time communication.

### Server

```typescript
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer);
```

### Client

```typescript
const socket = io(serverUrl, {
  auth: { secretId, sessionId },
  reconnection: true,
});
```

## Consequences

### Positive
- **Mature Library**: Well-tested, large community
- **Reconnection**: Built-in reconnection with backoff
- **Rooms**: Easy broadcasting to game sessions
- **Type Safety**: Strongly typed events
- **Fallbacks**: Falls back to polling if WebSocket fails

### Negative
- **Bundle Size**: Larger than raw WebSocket
- **Protocol**: Not standard WebSocket protocol
- **Vendor Lock-in**: Socket.IO-specific features

## Alternatives Considered

1. **Raw WebSocket**: Simpler but no reconnection/rooms
2. **ws library**: Lightweight but requires manual everything
3. **Phoenix Channels**: Would require Elixir backend
