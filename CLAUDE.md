# AI Assistant Context

**Dabb** is a multiplayer TypeScript monorepo for the Swabian card game Binokel: client (React Native + Expo, runs on Android/iOS/web), server (Node.js + Express + Socket.IO), shared packages. Stack: pnpm workspaces + Turborepo, PostgreSQL, Vitest, strict TypeScript.

## Project Structure

```
apps/{client, server}
packages/{shared-types, game-logic, game-canvas, ui-shared, card-assets, i18n}
docs/{arc42/, adr/, AI_STRATEGY.md, API.md, SOCKET_EVENTS.md, DATABASE.md, KEY_FILES.md}
deploy/  .github/workflows/  dev.sh  docker-compose.yml  DEPLOYMENT.md
```

## Key Patterns

### Event Sourcing

All state is managed through events stored in PostgreSQL and replayed via a reducer (`packages/game-logic/src/state/reducer.ts`). Enables reconnection, debugging, and anti-cheat.

Key events: `GameStartedEvent`, `CardsDealtEvent`, `BidPlacedEvent`, `PlayerPassedEvent`, `BiddingWonEvent`, `DabbTakenEvent`, `CardsDiscardedEvent`, `GoingOutEvent`, `TrumpDeclaredEvent`, `MeldsDeclaredEvent`, `MeldingCompleteEvent`, `CardPlayedEvent`, `TrickWonEvent`, `RoundScoredEvent`, `GameFinishedEvent`, `GameTerminatedEvent`.

### Anti-Cheat

Events are filtered before sending to clients so players only see their own cards. `CARDS_DEALT`, `CARDS_DISCARDED`, and `MELDING_COMPLETE` are never included in the game log.

### Scoreboard & Game Log

- **Scoreboard**: `useRoundHistory` hook; compact `ScoreboardStrip` + expandable modal in client.
- **Game Log**: `useGameLog` hook; shows latest entries; tab-based overlay in client; pulsing your-turn banner.

### Swabian Terminology

Suits: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦). Ranks: Ass, Zehn, König, Ober, **Buabe** (not Unter).

### Internationalization (i18n)

Languages: `de` (default), `en`. Use `useTranslation()` from `@dabb/i18n`. Swabian card terms (suits, ranks, melds, Dabb) stay untranslated in all languages. Add language: `/add-language` skill.

### Server Error Internationalization

Server throws `GameError(SERVER_ERROR_CODES.X, params)`. Socket emits `{ message: code, code, params }`. Client: `t(`serverErrors.${errorCode}`, params)`. Parameterized errors use `{{count}}` syntax. All error codes defined in `packages/shared-types/src/errors.ts` (categories: Session, Bidding, Dabb, Trump, Melding, Tricks, AI, General). Add error: `/add-error` skill.

## Commands

```bash
# Dev (Docker)
./dev.sh start|stop|logs|status|reset

# Build / test / quality
pnpm run build          # build all packages (also type-checks)
pnpm test               # run tests
pnpm test:coverage
pnpm run typecheck
pnpm lint && pnpm lint:fix
pnpm format && pnpm format:check
pnpm clean

# Dev servers
pnpm --filter @dabb/server dev
pnpm --filter @dabb/client start

# DB migrations (auto on server startup)
pnpm --filter @dabb/server db:migrate

# AI simulation (in-memory, no server/DB needed)
pnpm simulate -- --players 3 --games 100 --concurrency 4
```

## Key Files

See `docs/KEY_FILES.md` for the full list. Most important entry points:

| File                                               | Purpose                                                |
| -------------------------------------------------- | ------------------------------------------------------ |
| `packages/shared-types/src/`                       | All shared types (cards, game, events, errors, socket) |
| `packages/game-logic/src/state/reducer.ts`         | Event sourcing reducer                                 |
| `packages/game-logic/src/__tests__/testHelpers.ts` | Integration test helpers                               |
| `apps/server/src/socket/handlers.ts`               | Socket.IO event handlers                               |
| `apps/server/src/services/gameService.ts`          | Game logic service                                     |
| `packages/i18n/src/locales/`                       | Translation files (de.ts, en.ts)                       |

## Testing

Tests in `__tests__/` directories alongside source files. Run: `pnpm test` or `pnpm --filter @dabb/game-logic test`.

**Integration tests**: `testHelpers.ts` provides a fluent API (`game.alice.joins()`, `game.bob.bids(150)`, etc.). See `packages/game-logic/src/__tests__/README.md`.

**Regression tests**: Always add when fixing bugs. Document the scenario, use realistic values, name like `'does X correctly (regression)'`.

## Conventions

1. **No `any` types** — use proper TypeScript types
2. **Avoid mobile layout shifts** — never conditionally mount/unmount layout-affecting sections; use `opacity: 0` to hide, constant `borderWidth` toggling `borderColor` to `transparent`, placeholder text instead of `null`
3. **Event sourcing** — all state changes through events
4. **Swabian names** — Kreuz/Schippe/Herz/Bollen, Buabe not Unter
5. **Strict mode** — TypeScript strict is enabled
6. **Workspace imports** — use `@dabb/*` package imports
7. **Update documentation** — after API/endpoint/socket/schema changes update `docs/API.md`, `docs/SOCKET_EVENTS.md`, `docs/DATABASE.md`, and `CLAUDE.md` for new key files
8. **Verify CI before committing** — always run `/ci-check` (build + lint + test must all pass)

## Game Rules Reference

See `README.md` for full rules. Key points: 40-card deck (2 copies), bidding starts at 150, melds score points (Paar: 20, Familie: 100, Binokel: 40), must follow suit/beat/trump, first to 1000 wins.

**Going Out (Abgehen)**: After taking dabb, before discarding, bid winner can choose a trump suit to go out in. Bid winner loses their bid as points; opponents each get melds + 40 bonus. Round ends immediately. `wentOut: boolean` in GameState.

**AI Simulation**: `pnpm simulate` runs AI-only games in-memory (no DB/server). See `docs/AI_STRATEGY.md`. CLI flags: `--players`, `--games`, `--concurrency`, `--target-score`, `--max-actions`, `--timeout`, `--output-dir`.

## Versioning & Changelog

Version sources: root `package.json` (server) and `apps/client/app.json` `expo.version` — keep in sync.

Bump type: MAJOR (breaking protocol change), MINOR (new user feature), PATCH (bug fix/internal). Update all five `package.json`/`app.json` files and add an entry to `CHANGELOG.md` in user-friendly language (no jargon). MAJOR bumps must note that users must update the app.
