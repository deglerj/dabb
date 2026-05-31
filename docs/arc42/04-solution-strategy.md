# 4. Solution Strategy

## 4.1 Technology Decisions

| Decision                | Rationale                                                   |
| ----------------------- | ----------------------------------------------------------- |
| **TypeScript Monorepo** | Share types and game logic across all packages              |
| **Event Sourcing**      | Reliable state reconstruction, audit trail, easy debugging  |
| **Firebase RTDB**       | Serverless P2P — no application server to maintain or scale |
| **React**               | Component-based UI, large ecosystem                         |
| **Expo**                | Simplified React Native development for Android/iOS/web     |

## 4.2 Top-level Decomposition

The system is decomposed into:

1. **Shared Packages** - Types and logic used by all apps
2. **Client** - React Native + Expo app (Android/iOS/web)
3. **Firebase RTDB** - Google-managed backend; clients connect directly

## 4.3 Quality Approaches

### Reliability

- Event sourcing ensures no data loss
- All game state can be reconstructed by replaying events from Firebase RTDB
- Reconnection replays all events from the beginning of the session

### Security

- Client-side event filtering prevents players from seeing others' cards
- Secret IDs (`secretId`) stored locally; SHA-256 hash stored in Firebase
- Firebase security rules gate writes to registered session players only

### Performance

- React Compiler for automatic memoization
- Minimal event payloads
- Client-side state reduction

### Maintainability

- Strict TypeScript across all packages
- Shared game logic in dedicated package
- Clear separation of concerns
