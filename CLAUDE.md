# AI Assistant Context

**Dabb** is a multiplayer TypeScript monorepo for the Swabian card game Binokel: client (React + Vite, installable PWA, runs in any browser), shared packages. Stack: pnpm workspaces + Turborepo, Firebase Realtime Database, Vitest, strict TypeScript.

## Project Structure

```
apps/{client, simulate}
packages/{shared-types, game-logic, game-ai, game-canvas, ui-shared, card-assets, i18n, rn-compat}
docs/{arc42/, adr/, design/, AI_STRATEGY.md, KEY_FILES.md}
.github/workflows/  DEPLOYMENT.md  CHANGELOG.md
```

> **Note:** `apps/simulate` is the AI simulation CLI (`pnpm simulate`). There is no application server — the game backend is Firebase Realtime Database.

## Key Patterns

### Firebase P2P Architecture

All game state is stored as an append-only event log in Firebase RTDB per session. Clients read and write events directly — no application server intermediary.

### One Rules Engine

`packages/game-logic/src/engine/` turns a player action into the events it produces, validating it first and expanding the whole cascade (a card play can finish a trick, a round and the game). All three drivers go through `createEventsForAction`: the online client (`useFirebaseGame`, `useAI`), offline play (`OfflineGameEngine`) and the simulation (`SimulationEngine`). They differ only in transport and pacing. Do not re-implement scoring, dealing or phase advancement in a driver — that is exactly what drifted before.

Key client files: `apps/client/src/firebase/` (session, events, config, secretId) — transport only; the rules live in `packages/game-logic/src/engine/`

Key events: `GameStartedEvent`, `CardsDealtEvent`, `BidPlacedEvent`, `PlayerPassedEvent`, `BiddingWonEvent`, `DabbTakenEvent`, `CardsDiscardedEvent`, `GoingOutEvent`, `TrumpDeclaredEvent`, `MeldsDeclaredEvent`, `MeldingCompleteEvent`, `CardPlayedEvent`, `TrickWonEvent`, `RoundScoredEvent`, `GameFinishedEvent`, `GameTerminatedEvent`, `PlayerJoinedEvent`, `PlayerLeftEvent`, `PlayerReconnectedEvent`, `NewRoundStartedEvent`.

### Event Sourcing

Game state is reconstructed by replaying all events via a reducer (`packages/game-logic/src/state/reducer.ts`). On reconnect, the client fetches all events from Firebase and replays them.

### View Filtering (Client-Side)

`packages/game-logic/src/state/views.ts` — `filterEventForPlayer` is called by `useGameState` to hide opponents' cards in the UI. This is a UI-level concern only; raw events in Firebase are readable by all session participants. Firebase security rules (secretHash gating) prevent forging events.

- `CARDS_DEALT`: each player sees only their own hand; other hands and the dabb are replaced with hidden card placeholders.
- `BIDDING_WON`: the `dabb` field is stripped for non-winners (only the bid winner sees the dabb contents).
- `CARDS_DISCARDED`: only the discarding player sees the actual card IDs; others receive placeholder IDs of the same count.

### Emotes (the only player-to-player channel)

There is no chat. Players send one of six fixed reactions (`packages/shared-types/src/emotes.ts`), shown for `EMOTE_TTL_MS` (10s) next to the sender's name.

Emotes are **not events** and must stay out of the append-only log — they would replay on every reconnect and drag ephemeral chatter through the reducer, the view filter and the game log. Two disjoint sources feed one store (`apps/client/src/hooks/useEmotes.ts`, which merges per seat rather than replacing):

- **Human emotes** go over their own Firebase path, `sessions/<code>/emotes/<playerIndex>` (`apps/client/src/firebase/emotes.ts`), at the same trust level as `presence`.
- **AI emotes are derived, never transported.** `pickAIEmote` (`packages/game-ai/src/emotes.ts`) is a pure function of the event plus a hash of its id, so every client independently arrives at the same reaction — which is why bots need no Firebase write and no `claimCascade`. Keep it deterministic: a `Math.random()` in there makes every client show a different bot reaction at the same moment.

Emotes have their own replay guard, the event's **wall-clock age** — an emote is only visible for `EMOTE_TTL_MS` anyway, so age _is_ its display window, not a heuristic. Everything else uses `replayedEventIds` (below).

### Replay Guard: `replayedEventIds`

Rejoining, reloading and resuming an offline game all replay the whole log. Nothing cosmetic may fire for those events — no sound, no haptic, no trick sweep, no meld showcase, no round announcement or confetti. The player is dropped into the current state.

The signal is `GameInterface.replayedEventIds`: the ids of the events already in the log when this client joined. Only the driver knows it (`useFirebaseGame` takes it from the `getAllEvents` snapshot, `useOfflineGame` from the events restored from `localStorage`), and `GameScreen` hands it to every cosmetic consumer.

Two guards this replaced, so they don't come back:

- **`isInitialLoad`** flipped false after the first batch, and `onChildAdded` replays every existing child on attach — old events arrive in later batches and slipped through. `useFirebaseGame` now subscribes only _after_ the snapshot resolves, so that backlog is always inside the set.
- **Event age** works for emotes but not here: `timestamp` comes from whichever client wrote the event, so a skewed device clock misclassifies, and a player on a slow connection would lose the sounds for their own live game. Membership in the join snapshot is exact.

`useTrickAnimationState` is the one indirect case: `CompletedTrick` carries no event id, so `GameScreen` resolves the last `TRICK_WON` from the log and passes the boolean.

### Scoreboard & Game Log

- **Scoreboard**: `useRoundHistory` hook; compact `ScoreboardStrip` + expandable modal in client.
- **Game Log**: `useGameLog` hook turns events straight into display lines (it takes the nicknames and a `t` function); tab-based overlay in client.

### RN-Shaped Component Shim (`@dabb/rn-compat`)

The client and `game-canvas` UI is written against RN-shaped components (`View`, `Text`,
`Pressable`, `StyleSheet.create`, etc. — a leftover convention from a prior React Native
version of this app) implemented by `packages/rn-compat`, not `react-native`/`react-native-web`
(both fully removed). Style objects accept RN-only shorthands (`paddingHorizontal`,
`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`, `transform` as an array) —
`flattenStyle()` in `packages/rn-compat/src/styles.ts` normalizes them to plain CSS. See ADR
011 for why, and `packages/rn-compat/src/index.tsx`'s top-of-file comment for the shim's
documented ceiling before reaching for a new component or style property it doesn't cover.

Haptics live here too (`packages/rn-compat/src/haptics.ts`, RN's `Vibration` equivalent),
because the client _and_ `game-canvas` fire them and only `rn-compat` is a dependency of both.
`triggerHaptic` is the only place allowed to call `navigator.vibrate` — it is what reads the
options toggle, so a direct call bypasses the switch (that was the `HapticTouchableOpacity` bug).

### Swabian Terminology

Suits: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦). Ranks: Ass, Zehn, König, Ober, **Buabe** (not Unter).

### Internationalization (i18n)

Languages: `de` (default), `en`. Use `useTranslation()` from `@dabb/i18n`. Swabian card terms (suits, ranks, melds, Dabb) stay untranslated in all languages. Add language: `/add-language` skill.

### Game Error Codes

`GameError(GAME_ERROR_CODES.X, params)` is thrown by `game-logic/src/engine/actions.ts` when a player makes an invalid move, and by `firebase/session.ts` for session failures. Client: `t(`serverErrors.${errorCode}`, params)`. Parameterized errors use `{{count}}` syntax. All error codes defined in `packages/shared-types/src/errors.ts` (categories: Session, Game start, General game, Bidding, Dabb, Going out, Trump, Melding, Tricks, Game termination, Generic fallback). Add error: `/add-error` skill.

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

| File                                               | Purpose                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `packages/shared-types/src/`                       | All shared types (cards, game, events, errors)   |
| `packages/game-logic/src/state/reducer.ts`         | Event sourcing reducer                           |
| `packages/game-logic/src/__tests__/testHelpers.ts` | Integration test helpers                         |
| `packages/game-logic/src/engine/`                  | Action validation, event cascades, round scoring |
| `apps/client/src/hooks/useFirebaseGame.ts`         | Main game hook (Firebase subscriptions + state)  |
| `packages/i18n/src/locales/`                       | Translation files (de.ts, en.ts)                 |

## Testing

Tests in `__tests__/` directories alongside source files. Run: `pnpm test` or `pnpm --filter @dabb/game-logic test`.

**Integration tests**: `testHelpers.ts` provides a fluent API (`game.alice.joins()`, `game.bob.bids(150)`, etc.). See `packages/game-logic/src/__tests__/README.md`.

**Regression tests**: Always add when fixing bugs. Document the scenario, use realistic values, name like `'does X correctly (regression)'`.

**E2E smoke test**: `apps/client/e2e/startup-create-join.spec.ts` (Playwright) runs in CI against a real browser + Firebase RTDB Local Emulator — boots the app, creates a session in one browser context, joins by code from a second, catches startup/bundling breakage that `vitest`/`tsc` can't.

Run locally from repo root: `pnpm exec firebase emulators:start --only database --project demo-dabb` (terminal 1), `./dev.sh` or `cd apps/client && EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true pnpm exec vite` (terminal 2), then `cd apps/client && pnpm exec playwright test`. Playwright's own `webServer` config can also boot both automatically — see `apps/client/playwright.config.ts`.

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

**Bid winner phase order**: `dabb` (take it) → `trump` (declare it) → `discard` (lay four away) → `melding`. Trump is declared **before** the layaway so that burying a trump is a real decision. Buried trump must be announced: `filterCardsDiscarded` (views.ts) leaves trump-suited card IDs readable to everyone and replaces the rest with `'hidden'`, and `useGameLog` turns that into a `trump_discarded` entry. The reveal is derived per client from the card IDs, not reported by the discarder — so `filterEventsForPlayer` must be given the whole log (it folds the round's trump forward), never an isolated batch.

**Scoring a round**: melds + trick points, with the bid winner's discarded cards counting towards their tricks and 10 for the last trick. A player who won no trick forfeits their melds (per _team_ in 4-player games) — `wonATrick` in `scoring.ts` reads `state.trickHistory`, never `tricksTaken`, because the layaway sits in `tricksTaken` as a fake trick entry and laying cards away must not save the melds. Miss the bid and the whole round is discarded and replaced by **`-2 × winningBid`** (`bidMet: false`). Going out costs only `-1 × winningBid` — the 2:1 ratio is what makes Abgehen worth choosing, so don't "fix" one without the other. All of this lives once, in `game-logic/src/engine/scoring.ts`.

**Ending the game**: `determineGameWinner` (`game-logic/state/winner.ts`) is the single source of this rule — several players can cross the target in one round, so highest total wins, and an exact tie goes to the bid winner. Ties are common because every score component is a multiple of ten. If the tied players don't include the bid winner, the lowest seat index wins — arbitrary, and the known limitation. Every scoring path goes through the helper via `game-logic/src/engine/scoring.ts`; the call sites each used to inline the loop and drifted.

**Melds**: a card may pay in melds of different kinds (König in both a Paar and Vier Könige) — deliberate, and the common case in 2-player hands. The one exception is that a Familie absorbs the Paar of its own suit, and that rule exists _only_ because `detectPaar` is called last in `detectMelds` and receives the melds found so far. Do not reorder those pushes; `melds.test.ts` fails if you do.

**Going Out (Abgehen)**: After taking the dabb and declaring trump, instead of laying away, the bid winner can go out. Bid winner loses their bid once; opponents each get melds + 40 bonus. Round ends immediately. `wentOut: boolean` in GameState.

**4-player teams**: Partners sit opposite each other — team is always `playerIndex % 2`. Scoring is per team; team lookups must read `state.players` (populated from `PLAYER_JOINED`), never a `PlayerInfo[]` from Firebase session meta, which has no team field.

**Partner exemption**: In 4-player games, when your partner is currently winning the trick, "must beat" and "must trump" are lifted (following suit still applies). Pass `isPartnerWinning(...)` as the 4th argument to `getValidPlays`/`isValidPlay` — it defaults to `false`, so any new call site silently enforces the strict rules.

**AI Simulation**: `pnpm simulate` runs AI-only games in-memory (no Firebase). See `docs/AI_STRATEGY.md`. CLI flags: `--players`, `--games`, `--concurrency`, `--target-score`, `--max-actions`, `--timeout`, `--output-dir`, `--difficulty`, `--difficulties`.

`--difficulties hard,easy` puts a different bot in each seat and reports the win rate by bot rather than by seat; seats rotate one place per game so deal luck and seat order cancel. This is the only way to measure an AI change — with one setting for the whole table every seat is identical and there is nothing to compare. Deals are unseeded (`shuffleDeck` uses bare `Math.random()`); the rotation is what replaces seeding. Resolution is roughly 3pp at 1000 games, 1pp at 8000.

**AI knowledge is derived, never accumulated.** `buildRoundMemory` (`packages/game-ai/src/knowledge.ts`) rebuilds everything the AI knows from `GameState` on each decision, because `useAI` constructs a fresh `BinokelAIPlayer` per decision and any instance field is discarded immediately. It is also the _only_ place in the AI allowed to read `GameState`: all three drivers pass an unfiltered state, so `state.hands` holds every opponent's cards and `tricksTaken` holds the bid winner's layaway. `knowledge.test.ts` scrambles the hidden parts and asserts the output is unchanged — read state elsewhere and that guard is bypassed.

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

Version sources: root `package.json` and `apps/client/package.json` — keep in sync.

Bump type: MAJOR (breaking protocol change), MINOR (new user feature), PATCH (bug fix/internal). Update both version files and add an entry to `CHANGELOG.md` in user-friendly language (no jargon). MAJOR bumps must note that users on an outdated cached version should reload (the PWA's service worker prompts for this automatically — see `apps/client/src/main.tsx`).
