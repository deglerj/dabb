# AGENT.md - AI Assistant Context

This file provides context for AI assistants working on the Dabb codebase.

## Project Overview

**Dabb** is a multiplayer implementation of the traditional Swabian card game Binokel. It's built as a TypeScript monorepo with:

- **Web app** (React + Vite)
- **Mobile app** (React Native + Expo)
- **Server** (Bun + Express + Socket.IO)
- **Shared packages** (types, game logic, UI hooks)

## Tech Stack

| Component | Technology                 |
| --------- | -------------------------- |
| Monorepo  | Bun workspaces + Turborepo |
| Language  | TypeScript (strict mode)   |
| Backend   | Bun + Express + Socket.IO  |
| Database  | PostgreSQL                 |
| Web       | React 19 + Vite            |
| Mobile    | React Native + Expo        |
| Testing   | Vitest                     |

## Project Structure

```
dabb/
├── apps/
│   ├── web/           # React web app
│   ├── mobile/        # React Native app
│   └── server/        # Bun backend
├── packages/
│   ├── shared-types/  # TypeScript types
│   ├── game-logic/    # Core game rules
│   ├── ui-shared/     # Shared React hooks
│   └── card-assets/   # SVG graphics
├── docs/
│   ├── arc42/         # Architecture docs
│   └── adr/           # Decision records
└── .github/
    └── workflows/     # CI/CD
```

## Key Patterns

### Event Sourcing

All game state is managed through events:

- Events are stored in PostgreSQL
- State is computed by replaying events through a reducer
- Enables reconnection, debugging, and anti-cheat

### Anti-Cheat

Events are filtered before sending to clients so players only see their own cards.

### Swabian Terminology

Uses Swabian German card names:

- Suits: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦)
- Ranks: Ass, Zehn, König, Ober, Buabe, Neun

## Commands

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Start development servers
bun run --filter @dabb/server dev
bun run --filter @dabb/web dev
bun run --filter @dabb/mobile start

# Type check
bun run typecheck
```

## Key Files

| File                                        | Purpose                   |
| ------------------------------------------- | ------------------------- |
| `packages/shared-types/src/cards.ts`        | Card types and constants  |
| `packages/shared-types/src/game.ts`         | Game state and meld types |
| `packages/shared-types/src/events.ts`       | Event type definitions    |
| `packages/game-logic/src/state/reducer.ts`  | Event sourcing reducer    |
| `packages/game-logic/src/melds/detector.ts` | Meld detection            |
| `packages/game-logic/src/phases/tricks.ts`  | Trick-taking rules        |
| `packages/game-logic/src/export/`           | Event export for debug    |
| `apps/server/src/socket/handlers.ts`        | Socket.IO event handlers  |

## Testing

Tests are in `__tests__` directories alongside source files:

- `packages/game-logic/src/__tests__/` - Game logic tests
- Run with `bun test` or `bun run --filter @dabb/game-logic test`

## Conventions

1. **No `any` types** - Use proper TypeScript types
2. **Event sourcing** - All state changes through events
3. **Swabian names** - Use Kreuz/Schippe/Herz/Bollen, Buabe not Unter
4. **Strict mode** - TypeScript strict is enabled
5. **Workspace imports** - Use `@dabb/*` package imports
6. **Update documentation** - After adding/changing APIs, endpoints, or socket events, update:
   - `docs/API.md` for REST endpoints
   - `docs/SOCKET_EVENTS.md` for Socket.IO events
   - This file (`CLAUDE.md`) for new key files or patterns

## Game Rules Reference

See `README.md` for full game rules. Key points:

- 48-card deck (2 copies each)
- Bidding starts at 150
- Melds score points (Paar: 20, Familie: 100, Binokel: 40)
- Must follow suit, must beat, must trump
- First to 1500 wins
