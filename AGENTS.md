# AI Assistant Context

This file provides context for AI assistants working on the Dabb codebase.

## Project Overview

**Dabb** is a multiplayer implementation of the traditional Swabian card game Binokel. It's built as a TypeScript monorepo with:

- **Web app** (React + Vite)
- **Mobile app** (React Native + Expo)
- **Server** (Node.js + Express + Socket.IO)
- **Shared packages** (types, game logic, UI hooks)

## Tech Stack

| Component | Technology                    |
| --------- | ----------------------------- |
| Monorepo  | pnpm workspaces + Turborepo   |
| Language  | TypeScript (strict mode)      |
| Backend   | Node.js + Express + Socket.IO |
| Database  | PostgreSQL                    |
| Web       | React 19 + Vite               |
| Mobile    | React Native + Expo           |
| Testing   | Vitest                        |

## Project Structure

```
dabb/
├── apps/
│   ├── web/           # React web app
│   ├── mobile/        # React Native app
│   └── server/        # Node.js backend
├── packages/
│   ├── shared-types/  # TypeScript types
│   ├── game-logic/    # Core game rules
│   ├── ui-shared/     # Shared React hooks
│   └── card-assets/   # SVG graphics
├── docs/
│   ├── arc42/         # Architecture docs
│   └── adr/           # Decision records
├── deploy/            # Deployment scripts (Oracle Cloud)
├── .github/
│   └── workflows/     # CI/CD
├── dev.sh             # Docker dev helper script
├── docker-compose.yml # Development Docker config
├── docker-compose.prod.yml
└── DEPLOYMENT.md      # Deployment documentation
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
- Ranks: Ass, Zehn, König, Ober, Buabe

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm test
pnpm test:coverage        # With coverage report

# Start development servers
pnpm --filter @dabb/server dev
pnpm --filter @dabb/web dev
pnpm --filter @dabb/mobile start

# Type check
pnpm run typecheck

# Code quality
pnpm lint                 # Run ESLint
pnpm lint:fix             # Fix ESLint issues
pnpm format               # Run Prettier
pnpm format:check         # Check formatting
pnpm clean                # Clean build artifacts

# Docker development (requires Docker)
pnpm docker:start         # Start PostgreSQL container
pnpm docker:stop          # Stop containers
pnpm docker:logs          # View container logs
pnpm docker:status        # Check container status
pnpm docker:reset         # Reset database
```

## Key Files

| File                                         | Purpose                    |
| -------------------------------------------- | -------------------------- |
| `packages/shared-types/src/cards.ts`         | Card types and constants   |
| `packages/shared-types/src/game.ts`          | Game state and meld types  |
| `packages/shared-types/src/events.ts`        | Event type definitions     |
| `packages/shared-types/src/api.ts`           | API request/response types |
| `packages/shared-types/src/socket.ts`        | Socket event types         |
| `packages/game-logic/src/state/reducer.ts`   | Event sourcing reducer     |
| `packages/game-logic/src/state/views.ts`     | State view functions       |
| `packages/game-logic/src/melds/detector.ts`  | Meld detection             |
| `packages/game-logic/src/phases/bidding.ts`  | Bidding phase logic        |
| `packages/game-logic/src/phases/tricks.ts`   | Trick-taking rules         |
| `packages/game-logic/src/export/`            | Event export for debug     |
| `packages/ui-shared/src/useGameState.ts`     | Game state React hook      |
| `packages/ui-shared/src/useSocket.ts`        | Socket.IO React hook       |
| `apps/server/src/socket/handlers.ts`         | Socket.IO event handlers   |
| `apps/server/src/services/eventService.ts`   | Event persistence          |
| `apps/server/src/services/gameService.ts`    | Game logic service         |
| `apps/server/src/services/sessionService.ts` | Session management         |
| `apps/server/src/db/pool.ts`                 | Database connection pool   |

## Testing

Tests are in `__tests__` directories alongside source files:

- `packages/game-logic/src/__tests__/` - Game logic tests
- Run with `pnpm test` or `pnpm --filter @dabb/game-logic test`

### Regression Tests

**Always add regression tests when fixing bugs.** A regression test should:

1. Document the bug scenario in a comment
2. Use realistic values that reproduce the original issue
3. Verify the fix works correctly
4. Prevent the bug from being reintroduced

Example naming: `'authenticates when session code differs from session UUID (regression)'`

## Conventions

1. **No `any` types** - Use proper TypeScript types
2. **Event sourcing** - All state changes through events
3. **Swabian names** - Use Kreuz/Schippe/Herz/Bollen, Buabe not Unter
4. **Strict mode** - TypeScript strict is enabled
5. **Workspace imports** - Use `@dabb/*` package imports
6. **Update documentation** - After adding/changing APIs, endpoints, or socket events, update:
   - `docs/API.md` for REST endpoints
   - `docs/SOCKET_EVENTS.md` for Socket.IO events
   - `docs/DATABASE.md` for database schema changes
   - This file (`CLAUDE.md`) for new key files or patterns

## Game Rules Reference

See `README.md` for full game rules. Key points:

- 40-card deck (2 copies each)
- Bidding starts at 150
- Melds score points (Paar: 20, Familie: 100, Binokel: 40)
- Must follow suit, must beat, must trump
- First to 1000 wins
