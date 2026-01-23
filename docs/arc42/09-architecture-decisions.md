# 9. Architecture Decisions

See the [Architecture Decision Records](../adr/) for detailed decisions:

| ADR                                      | Title                                 | Status   |
| ---------------------------------------- | ------------------------------------- | -------- |
| [001](../adr/001-event-sourcing.md)      | Use Event Sourcing for Game State     | Accepted |
| [002](../adr/002-monorepo-structure.md)  | Monorepo with pnpm + Turborepo        | Accepted |
| [003](../adr/003-socket-io.md)           | Socket.IO for Real-time Communication | Accepted |
| [004](../adr/004-swabian-terminology.md) | Use Swabian German Terminology        | Accepted |

## Key Decisions Summary

### Event Sourcing

- All game actions stored as events
- State reconstructed by replaying events
- Enables reconnection and debugging

### Monorepo

- Single repository for all code
- Shared types prevent drift
- Coordinated releases

### Socket.IO

- Mature WebSocket library
- Built-in reconnection
- Room/namespace support

### Swabian Terminology

- Authentic card names (Kreuz, Schippe, Herz, Bollen)
- Authentic rank names (Buabe instead of Unter)
- Regional authenticity
