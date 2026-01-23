# 4. Solution Strategy

## 4.1 Technology Decisions

| Decision                | Rationale                                                  |
| ----------------------- | ---------------------------------------------------------- |
| **TypeScript Monorepo** | Share types and game logic between server and clients      |
| **Event Sourcing**      | Reliable state reconstruction, audit trail, easy debugging |
| **Socket.IO**           | Mature WebSocket library with reconnection support         |
| **React**               | Component-based UI, large ecosystem                        |
| **Expo**                | Simplified React Native development                        |

## 4.2 Top-level Decomposition

The system is decomposed into:

1. **Shared Packages** - Types and logic used by all apps
2. **Server** - API and game coordination
3. **Web Client** - Browser-based UI
4. **Mobile Client** - Android app

## 4.3 Quality Approaches

### Reliability

- Event sourcing ensures no data loss
- All game state can be reconstructed from events
- Socket.IO handles reconnection automatically

### Security

- Event filtering prevents players from seeing others' cards
- Secret IDs for session authentication
- No direct database access from clients

### Performance

- React Compiler for automatic memoization
- Minimal event payloads
- Client-side state reduction

### Maintainability

- Strict TypeScript across all packages
- Shared game logic in dedicated package
- Clear separation of concerns
