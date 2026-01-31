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
│   ├── card-assets/   # SVG graphics
│   └── i18n/          # Internationalization (i18n)
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

**Key Events:**

- `GameStartedEvent`, `CardsDealtEvent` - Game lifecycle
- `BidPlacedEvent`, `PlayerPassedEvent`, `BiddingWonEvent` - Bidding phase
- `DabbTakenEvent`, `CardsDiscardedEvent`, `GoingOutEvent`, `TrumpDeclaredEvent` - Dabb/Trump phases
- `MeldsDeclaredEvent`, `MeldingCompleteEvent` - Melding phase
- `CardPlayedEvent`, `TrickWonEvent` - Tricks phase
- `RoundScoredEvent`, `GameFinishedEvent` - Scoring/End
- `GameTerminatedEvent` - Game terminated by player exit (no winner)

### Anti-Cheat

Events are filtered before sending to clients so players only see their own cards.

### Scoreboard

The scoreboard displays round-by-round history computed client-side from events:

- **Data source**: Uses `useRoundHistory` hook to compute history from `BiddingWonEvent`, `RoundScoredEvent`, and `GameFinishedEvent`
- **Minimizable**: Collapsed by default on mobile (< 768px), expandable to show full history
- **Round details**: Shows bid winner, winning bid, and per-player scores (melds + tricks)
- **Bid tracking**: Highlights rounds where the bid winner didn't meet their bid
- **Web**: Table-based layout in `apps/web/src/components/game/ScoreBoard.tsx`
- **Mobile**: Compact header (`ScoreBoardHeader.tsx`) during play, full modal view when expanded

### Game Log

The game log displays player actions in real-time, helping players follow the game like they would at a physical table:

- **Data source**: Uses `useGameLog` hook to convert game events to displayable log entries
- **Visible entries**: Shows 5 latest entries by default, expandable to show full history with scrolling
- **Your turn indicator**: Pulsing banner shown above log entries when it's the player's turn
- **Meld details**: Meld declarations show total points with expandable breakdown of individual melds
- **Web**: Right sidebar (300px) on desktop, bottom overlay on mobile (< 768px)
- **Mobile**: Bottom overlay with semi-transparent background

**Anti-cheat safety**: The following events are NOT logged because they contain secret card information:

- `CARDS_DEALT` - Players' hole cards
- `DABB_TAKEN` - Dabb cards picked up
- `CARDS_DISCARDED` - Cards discarded to dabb
- `MELDING_COMPLETE` - Redundant with `MELDS_DECLARED`

**Event-to-log mapping**:

| Event               | Log Message                                    |
| ------------------- | ---------------------------------------------- |
| `GAME_STARTED`      | "Game started (X players, target: Y)"          |
| `NEW_ROUND_STARTED` | "Round X started"                              |
| `BID_PLACED`        | "{name} bids {amount}"                         |
| `PLAYER_PASSED`     | "{name} passes"                                |
| `BIDDING_WON`       | "{name} wins bidding with {bid}"               |
| `GOING_OUT`         | "{name} goes out in {suit}"                    |
| `TRUMP_DECLARED`    | "{name} declares {suit} as trump"              |
| `MELDS_DECLARED`    | "{name} declares {points} points" + expandable |
| `CARD_PLAYED`       | "{name} plays {card}"                          |
| `TRICK_WON`         | "{name} wins the trick ({points} points)"      |
| `ROUND_SCORED`      | "Round ended"                                  |
| `GAME_FINISHED`     | "{name} wins the game!"                        |
| `GAME_TERMINATED`   | "{name} left the game"                         |

### Swabian Terminology

Uses Swabian German card names:

- Suits: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦)
- Ranks: Ass, Zehn, König, Ober, Buabe

### Internationalization (i18n)

The app supports multiple languages via the `@dabb/i18n` package:

- **Supported languages**: German (de), English (en)
- **Default**: German
- **Storage**: localStorage (web), AsyncStorage (mobile)

**Untranslated terms** (Swabian game terminology remains in German across all languages):

- Suits: Kreuz, Schippe, Herz, Bollen
- Ranks: Buabe, Ober, König, Zehn, Ass
- Melds: Paar, Familie, Binokel, Doppel-Binokel, etc.
- Game terms: Dabb, Binokel

**Usage in components:**

```tsx
import { useTranslation } from '@dabb/i18n';

function MyComponent() {
  const { t } = useTranslation();
  return <p>{t('common.loading')}</p>;
}
```

**Adding a new language:**

1. Create `packages/i18n/src/locales/[lang].ts` (copy from `de.ts`)
2. Add to `SUPPORTED_LANGUAGES` in `packages/i18n/src/types.ts`
3. Export from `packages/i18n/src/locales/index.ts`
4. Add label to `LANGUAGE_LABELS` in `types.ts`

### Server Error Internationalization

Server errors are internationalized using error codes. The server sends structured error codes, and clients translate them to localized messages.

**How it works:**

1. Server throws `GameError` with a code and optional params:

   ```typescript
   import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

   throw new GameError(SERVER_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: 4 });
   ```

2. Socket handler catches the error and emits structured data:

   ```typescript
   socket.emit('error', { message: code, code, params });
   ```

3. Client translates the error code before displaying:
   ```typescript
   const translatedError = t(`serverErrors.${errorCode}`, params);
   setError(translatedError);
   ```

**Error codes** are defined in `packages/shared-types/src/errors.ts`:

| Category | Example Codes                                                                    |
| -------- | -------------------------------------------------------------------------------- |
| Session  | `SESSION_NOT_FOUND`, `SESSION_FULL`, `GAME_ALREADY_STARTED`                      |
| Bidding  | `NOT_IN_BIDDING_PHASE`, `NOT_YOUR_TURN_TO_BID`, `FIRST_BIDDER_MUST_BID`          |
| Dabb     | `NOT_IN_DABB_PHASE`, `ONLY_BID_WINNER_CAN_TAKE_DABB`, `MUST_DISCARD_EXACT_COUNT` |
| Trump    | `NOT_IN_TRUMP_PHASE`, `ONLY_BID_WINNER_CAN_DECLARE_TRUMP`                        |
| Melding  | `NOT_IN_MELDING_PHASE`, `ALREADY_DECLARED_MELDS`, `CANNOT_MELD_WHEN_GOING_OUT`   |
| Tricks   | `NOT_IN_TRICKS_PHASE`, `INVALID_PLAY`, `CARD_NOT_IN_HAND`                        |
| General  | `NOT_YOUR_TURN`, `UNKNOWN_ERROR`                                                 |

**Adding a new error:**

1. Add the error code to `SERVER_ERROR_CODES` in `packages/shared-types/src/errors.ts`
2. Add translations to both `packages/i18n/src/locales/de.ts` and `en.ts` in the `serverErrors` namespace
3. Add the type to `serverErrors` interface in `packages/i18n/src/types.ts`
4. Use `throw new GameError(SERVER_ERROR_CODES.YOUR_NEW_ERROR)` in server code

**Parameterized errors** use i18next interpolation syntax:

- Translation: `'Exactly {{count}} cards must be discarded'`
- Throw: `new GameError(SERVER_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: 4 })`

## Commands

```bash
# Install dependencies
pnpm install

# Docker dev helper script
./dev.sh start            # Start containers
./dev.sh stop             # Stop containers
./dev.sh logs             # Watch container logs (runs continuously until Ctrl+C)
./dev.sh status           # Check container status
./dev.sh reset            # Reset database

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

# Database migrations (run automatically on server startup)
pnpm --filter @dabb/server db:migrate  # Run manually if needed
```

## Key Files

| File                                                         | Purpose                        |
| ------------------------------------------------------------ | ------------------------------ |
| `packages/shared-types/src/cards.ts`                         | Card types and constants       |
| `packages/shared-types/src/game.ts`                          | Game state and meld types      |
| `packages/shared-types/src/events.ts`                        | Event type definitions         |
| `packages/shared-types/src/errors.ts`                        | Error codes and GameError      |
| `packages/shared-types/src/gameLog.ts`                       | Game log entry types           |
| `packages/shared-types/src/api.ts`                           | API request/response types     |
| `packages/shared-types/src/socket.ts`                        | Socket event types             |
| `packages/game-logic/src/state/reducer.ts`                   | Event sourcing reducer         |
| `packages/game-logic/src/state/views.ts`                     | State view functions           |
| `packages/game-logic/src/melds/detector.ts`                  | Meld detection                 |
| `packages/game-logic/src/phases/bidding.ts`                  | Bidding phase logic            |
| `packages/game-logic/src/phases/tricks.ts`                   | Trick-taking rules             |
| `packages/game-logic/src/export/`                            | Event export for debug         |
| `packages/game-logic/src/__tests__/testHelpers.ts`           | Integration test utilities     |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Full round integration test    |
| `packages/ui-shared/src/useGameState.ts`                     | Game state React hook          |
| `packages/ui-shared/src/useSocket.ts`                        | Socket.IO React hook           |
| `packages/ui-shared/src/useRoundHistory.ts`                  | Round history for scoreboard   |
| `packages/ui-shared/src/useGameLog.ts`                       | Game log entries hook          |
| `packages/ui-shared/src/useLocalStorage.ts`                  | Session credentials hook       |
| `apps/web/src/hooks/useGame.ts`                              | Web game hook with i18n errors |
| `apps/web/src/components/game/ScoreBoard.tsx`                | Web scoreboard component       |
| `apps/web/src/components/game/GameLog.tsx`                   | Web game log component         |
| `apps/web/src/components/ConfirmModal.tsx`                   | Reusable confirmation modal    |
| `apps/web/src/components/game/GameTerminatedModal.tsx`       | Game terminated notification   |
| `apps/mobile/src/hooks/useSocket.ts`                         | Mobile socket with i18n errors |
| `apps/mobile/src/components/game/ScoreBoard.tsx`             | Mobile scoreboard component    |
| `apps/mobile/src/components/game/ScoreBoardHeader.tsx`       | Mobile compact scoreboard      |
| `apps/mobile/src/components/game/GameLog.tsx`                | Mobile game log component      |
| `apps/server/src/socket/handlers.ts`                         | Socket.IO event handlers       |
| `apps/server/src/services/eventService.ts`                   | Event persistence              |
| `apps/server/src/services/gameService.ts`                    | Game logic service             |
| `apps/server/src/services/sessionService.ts`                 | Session management             |
| `apps/server/src/services/cleanupService.ts`                 | Inactive session cleanup       |
| `apps/server/src/scheduler/cleanupScheduler.ts`              | Cleanup background job         |
| `apps/server/src/db/pool.ts`                                 | Database connection pool       |
| `apps/server/src/db/runMigrations.ts`                        | Database migration runner      |
| `apps/server/src/db/migrations/`                             | SQL migration files            |
| `packages/i18n/src/locales/de.ts`                            | German translations            |
| `packages/i18n/src/locales/en.ts`                            | English translations           |
| `packages/i18n/src/types.ts`                                 | i18n types and config          |
| `packages/i18n/src/config.ts`                                | i18next initialization         |
| `packages/i18n/src/components/I18nProvider.tsx`              | React i18n provider            |

## Testing

Tests are in `__tests__` directories alongside source files:

- `packages/game-logic/src/__tests__/` - Game logic tests
- Run with `pnpm test` or `pnpm --filter @dabb/game-logic test`

### Integration Test Helpers

The `packages/game-logic/src/__tests__/testHelpers.ts` module provides a fluent API for writing integration tests with deterministic game flows. See `packages/game-logic/src/__tests__/README.md` for full documentation.

```typescript
import { GameTestHelper, card, createHand } from './testHelpers.js';

const game = GameTestHelper.create('test-session');
game.alice.joins();
game.bob.joins();
game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });
game.dealCards({ alice: aliceHand, bob: bobHand, dabb: dabbCards });

// Fluent player actions
game.bob.bids(150);
game.alice.bids(160);
game.bob.passes();

expect(game.state.phase).toBe('dabb');
expect(game.state.bidWinner).toBe(0);
```

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

### Going Out (Abgehen)

After taking the dabb, the bid winner can choose to "go out" if they don't think they can make their bid:

- **When**: After taking dabb, before discarding
- **Action**: Choose a trump suit to "go out in" (e.g., "Ab in Schippen")
- **Bid winner**: Loses points equal to their bid (subtracted from score), cannot meld
- **Opponents**: Each gets their melds + 40 bonus points
- **Effect**: Round ends immediately (no tricks phase), new round starts
- **State**: `wentOut: boolean` in GameState tracks this, reset on new round
