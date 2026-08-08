# ADR 002: Monorepo with pnpm + Turborepo

## Status

Accepted

## Context

The project consists of multiple applications that share code (types, game logic). We need to decide how to organize the codebase.

## Decision

We will use a **monorepo** structure with:

- **pnpm** for package management (workspace protocol)
- **Turborepo** for build orchestration

```
dabb/
├── apps/
│   ├── client/     # React (Vite) PWA client
│   └── simulate/   # AI simulation CLI
├── packages/
│   ├── shared-types/   # TypeScript types
│   ├── game-logic/     # Game rules
│   ├── game-ai/        # AI player logic and offline game engine
│   ├── game-canvas/    # WebGL/Canvas2D card table rendering
│   ├── ui-shared/      # React hooks
│   ├── card-assets/    # Card display data (suit/rank symbols, colors)
│   ├── i18n/           # Internationalization (de/en)
│   └── rn-compat/      # Minimal React Native-shaped component shim
├── pnpm-workspace.yaml
└── turbo.json
```

There is no application server — the game backend is Firebase Realtime Database, and clients read/write events directly (see ADR 001).

## Consequences

### Positive

- **Shared Code**: Types and logic used everywhere
- **Type Safety**: Changes to types immediately visible
- **Coordinated Releases**: All apps updated together
- **Fast Builds**: Turborepo caches and parallelizes

### Negative

- **Complexity**: More complex than separate repos
- **Learning Curve**: Team must understand monorepo tooling
- **CI Setup**: Need to configure selective builds

## Alternatives Considered

1. **Separate Repositories**: Simpler but types/logic duplicated
2. **npm Workspaces**: Less powerful than pnpm
3. **Lerna**: Older tooling, less performant than Turborepo
