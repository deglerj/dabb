# AI Assistant Context

**Dabb** is a multiplayer TypeScript monorepo for the Swabian card game Binokel: client (React Native + Expo, runs on Android/iOS/web), shared packages. Stack: pnpm workspaces + Turborepo, Firebase Realtime Database, Vitest, strict TypeScript.

## Project Structure

```
apps/{client, simulate}
packages/{shared-types, game-logic, game-ai, game-canvas, ui-shared, card-assets, i18n}
docs/{arc42/, adr/, design/, AI_STRATEGY.md, KEY_FILES.md}
.github/workflows/  DEPLOYMENT.md  CHANGELOG.md
```

> **Note:** `apps/simulate` is the AI simulation CLI (`pnpm simulate`). There is no application server — the game backend is Firebase Realtime Database.

## Key Patterns

### Firebase P2P Architecture

All game state is stored as an append-only event log in Firebase RTDB per session. Clients read and write events directly — no application server intermediary.

Key client files: `apps/client/src/firebase/` (session, events, config, gameEventFactory, secretId)

Key events: `GameStartedEvent`, `CardsDealtEvent`, `BidPlacedEvent`, `PlayerPassedEvent`, `BiddingWonEvent`, `DabbTakenEvent`, `CardsDiscardedEvent`, `GoingOutEvent`, `TrumpDeclaredEvent`, `MeldsDeclaredEvent`, `MeldingCompleteEvent`, `CardPlayedEvent`, `TrickWonEvent`, `RoundScoredEvent`, `GameFinishedEvent`, `GameTerminatedEvent`, `PlayerJoinedEvent`, `PlayerLeftEvent`, `PlayerReconnectedEvent`, `NewRoundStartedEvent`.

### Event Sourcing

Game state is reconstructed by replaying all events via a reducer (`packages/game-logic/src/state/reducer.ts`). On reconnect, the client fetches all events from Firebase and replays them.

### View Filtering (Client-Side)

`packages/game-logic/src/state/views.ts` — `filterEventForPlayer` is called by `useGameState` to hide opponents' cards in the UI. This is a UI-level concern only; raw events in Firebase are readable by all session participants. Firebase security rules (secretHash gating) prevent forging events.

- `CARDS_DEALT`: each player sees only their own hand; other hands and the dabb are replaced with hidden card placeholders.
- `BIDDING_WON`: the `dabb` field is stripped for non-winners (only the bid winner sees the dabb contents).
- `CARDS_DISCARDED`: only the discarding player sees the actual card IDs; others receive placeholder IDs of the same count.

### Scoreboard & Game Log

- **Scoreboard**: `useRoundHistory` hook; compact `ScoreboardStrip` + expandable modal in client.
- **Game Log**: `useGameLog` hook; shows latest entries; tab-based overlay in client; pulsing your-turn banner.

### Swabian Terminology

Suits: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦). Ranks: Ass, Zehn, König, Ober, **Buabe** (not Unter).

### Internationalization (i18n)

Languages: `de` (default), `en`. Use `useTranslation()` from `@dabb/i18n`. Swabian card terms (suits, ranks, melds, Dabb) stay untranslated in all languages. Add language: `/add-language` skill.

### Game Error Codes

`GameError(GAME_ERROR_CODES.X, params)` is thrown client-side in `gameEventFactory.ts` when a player makes an invalid move. Client: `t(`serverErrors.${errorCode}`, params)`. Parameterized errors use `{{count}}` syntax. All error codes defined in `packages/shared-types/src/errors.ts` (categories: Session, Game start, General game, Bidding, Dabb, Going out, Trump, Melding, Tricks, Game termination, AI, Generic fallback). Add error: `/add-error` skill.

## Commands

```bash
# Build / test / quality
pnpm run build          # build all packages (also type-checks)
pnpm test               # run tests
pnpm test:coverage
pnpm run typecheck
pnpm lint && pnpm lint:fix
pnpm format && pnpm format:check
pnpm clean

# Dev server
pnpm --filter @dabb/client start

# AI simulation (in-memory, no server/DB needed)
pnpm simulate -- --players 3 --games 100 --concurrency 4
```

## Key Files

See `docs/KEY_FILES.md` for the full list. Most important entry points:

| File                                               | Purpose                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| `packages/shared-types/src/`                       | All shared types (cards, game, events, errors)      |
| `packages/game-logic/src/state/reducer.ts`         | Event sourcing reducer                              |
| `packages/game-logic/src/__tests__/testHelpers.ts` | Integration test helpers                            |
| `apps/client/src/firebase/gameEventFactory.ts`     | Client-side game action validation + event creation |
| `apps/client/src/hooks/useFirebaseGame.ts`         | Main game hook (Firebase subscriptions + state)     |
| `packages/i18n/src/locales/`                       | Translation files (de.ts, en.ts)                    |

## Testing

Tests in `__tests__/` directories alongside source files. Run: `pnpm test` or `pnpm --filter @dabb/game-logic test`.

**Integration tests**: `testHelpers.ts` provides a fluent API (`game.alice.joins()`, `game.bob.bids(150)`, etc.). See `packages/game-logic/src/__tests__/README.md`.

**Regression tests**: Always add when fixing bugs. Document the scenario, use realistic values, name like `'does X correctly (regression)'`.

**Android smoke test**: `apps/client/e2e/startup-create-join.yaml` (Maestro) runs in CI against a real Android emulator + Firebase RTDB Local Emulator — catches native startup crashes that `vitest`/`tsc` can't (e.g. native module version mismatches). Run locally: see Task 4 validation steps in `docs/superpowers/plans/2026-07-11-android-startup-smoke-test.md`, or re-run `maestro test apps/client/e2e/startup-create-join.yaml` against a running emulator with the app already installed.

## Conventions

1. **No `any` types** — use proper TypeScript types
2. **Avoid mobile layout shifts** — never conditionally mount/unmount layout-affecting sections; use `opacity: 0` to hide, constant `borderWidth` toggling `borderColor` to `transparent`, placeholder text instead of `null`
3. **Event sourcing** — all state changes through events
4. **Swabian names** — Kreuz/Schippe/Herz/Bollen, Buabe not Unter
5. **Strict mode** — TypeScript strict is enabled
6. **Workspace imports** — use `@dabb/*` package imports
7. **Update documentation** — after significant changes update `CLAUDE.md` for new key files; use `/update-docs` skill for automated review
8. **Verify CI before committing** — always run `/ci-check` (build + lint + test must all pass)

## Game Rules Reference

See `README.md` for full rules. Key points: 40-card deck (2 copies), bidding starts at 150, melds score points (Paar: 20, Familie: 100, Binokel: 40), must follow suit/beat/trump, first to 1000 wins.

**Going Out (Abgehen)**: After taking dabb, before discarding, bid winner can choose a trump suit to go out in. Bid winner loses their bid as points; opponents each get melds + 40 bonus. Round ends immediately. `wentOut: boolean` in GameState.

**AI Simulation**: `pnpm simulate` runs AI-only games in-memory (no Firebase). See `docs/AI_STRATEGY.md`. CLI flags: `--players`, `--games`, `--concurrency`, `--target-score`, `--max-actions`, `--timeout`, `--output-dir`.

## Available Skills / Slash Commands

| Skill               | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `/ci-check`         | Run full CI suite locally (build + lint + test)    |
| `/fix-ci`           | Diagnose and fix a failing CI run on GitHub        |
| `/add-error`        | Add a new game error code end-to-end               |
| `/add-language`     | Add a new i18n language end-to-end                 |
| `/update-docs`      | Review recent changes and sync documentation       |
| `/merge-dependabot` | Merge all open Dependabot PRs one at a time        |
| `/housekeeping`     | Full project housekeeping (deps, docs, stale code) |

## Versioning & Changelog

Version sources: root `package.json` and `apps/client/app.json` `expo.version` — keep in sync.

Bump type: MAJOR (breaking protocol change), MINOR (new user feature), PATCH (bug fix/internal). Update all version files (`package.json` root, `apps/client/package.json`, `apps/client/app.json`) and add an entry to `CHANGELOG.md` in user-friendly language (no jargon). MAJOR bumps must note that users must update the app.
