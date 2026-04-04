# ADR 002: Monorepo with pnpm + Turborepo

## Status

Accepted

## Context

The project consists of multiple applications (web, mobile, server) that share code (types, game logic). We need to decide how to organize the codebase.

## Decision

We will use a **monorepo** structure with:

- **pnpm** for package management (workspace protocol)
- **Turborepo** for build orchestration

```
dabb/
├── apps/
│   ├── client/     # React Native + Expo app (Android/iOS/web)
│   └── server/     # Node.js backend
├── packages/
│   ├── shared-types/   # TypeScript types
│   ├── game-logic/     # Game rules
│   ├── game-canvas/    # Skia card table rendering
│   ├── ui-shared/      # React hooks
│   ├── card-assets/    # SVG graphics
│   └── i18n/           # Internationalization (de/en)
├── pnpm-workspace.yaml
└── turbo.json
```

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
