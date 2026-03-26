# Key Files

| File                                                         | Purpose                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `packages/shared-types/src/cards.ts`                         | Card types and constants                                                        |
| `packages/shared-types/src/game.ts`                          | Game state and meld types                                                       |
| `packages/shared-types/src/events.ts`                        | Event type definitions                                                          |
| `packages/shared-types/src/errors.ts`                        | Error codes and GameError                                                       |
| `packages/shared-types/src/gameLog.ts`                       | Game log entry types                                                            |
| `packages/shared-types/src/ai.ts`                            | AI player types                                                                 |
| `packages/shared-types/src/api.ts`                           | API request/response types                                                      |
| `packages/shared-types/src/socket.ts`                        | Socket event types                                                              |
| `packages/game-logic/src/state/reducer.ts`                   | Event sourcing reducer                                                          |
| `packages/game-logic/src/state/views.ts`                     | State view functions                                                            |
| `packages/game-logic/src/melds/detector.ts`                  | Meld detection                                                                  |
| `packages/game-logic/src/phases/bidding.ts`                  | Bidding phase logic                                                             |
| `packages/game-logic/src/phases/tricks.ts`                   | Trick-taking rules                                                              |
| `packages/game-logic/src/export/`                            | Event export for debug                                                          |
| `packages/game-logic/src/__tests__/testHelpers.ts`           | Integration test utilities                                                      |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Full round integration test                                                     |
| `packages/ui-shared/src/useGameState.ts`                     | Game state React hook                                                           |
| `packages/ui-shared/src/useSocket.ts`                        | Socket.IO React hook                                                            |
| `packages/ui-shared/src/useRoundHistory.ts`                  | Round history for scoreboard                                                    |
| `packages/ui-shared/src/useGameLog.ts`                       | Game log entries hook                                                           |
| `packages/ui-shared/src/useActionRequired.ts`                | Your-turn detection hook                                                        |
| `packages/ui-shared/src/useCelebration.ts`                   | Win celebration effects hook                                                    |
| `packages/ui-shared/src/useTrickAnimationState.ts`           | Trick animation phase state machine                                             |
| `apps/client/src/hooks/useStorage.ts`                        | Session credential persistence (AsyncStorage / localStorage)                    |
| `packages/game-canvas/src/cards/cardPositions.ts`            | Single source of truth for all card positions (trick, hand, won-pile, opponent) |
| `packages/game-canvas/src/cards/CardView.tsx`                | Animated card with arc flight (initialX/Y)                                      |
| `apps/client/src/components/game/TrickAnimationLayer.tsx`    | Full-screen trick card animation overlay                                        |
| `apps/client/src/components/ui/GameScreen.tsx`               | Main game screen                                                                |
| `apps/server/src/socket/handlers.ts`                         | Socket.IO event handlers                                                        |
| `apps/server/src/services/eventService.ts`                   | Event persistence                                                               |
| `apps/server/src/services/gameService.ts`                    | Game logic service                                                              |
| `apps/server/src/services/sessionService.ts`                 | Session management                                                              |
| `apps/server/src/services/cleanupService.ts`                 | Inactive session cleanup                                                        |
| `apps/server/src/ai/AIPlayer.ts`                             | AI player interface & factory                                                   |
| `apps/server/src/ai/BinokelAIPlayer.ts`                      | AI player decision logic (easy/medium/hard)                                     |
| `apps/server/src/services/aiControllerService.ts`            | AI player lifecycle management                                                  |
| `apps/server/src/scheduler/cleanupScheduler.ts`              | Cleanup background job                                                          |
| `apps/server/src/db/pool.ts`                                 | Database connection pool                                                        |
| `apps/server/src/db/runMigrations.ts`                        | Database migration runner                                                       |
| `apps/server/src/db/migrations/`                             | SQL migration files                                                             |
| `packages/i18n/src/locales/de.ts`                            | German translations                                                             |
| `packages/i18n/src/locales/en.ts`                            | English translations                                                            |
| `packages/i18n/src/types.ts`                                 | i18n types and config                                                           |
| `packages/i18n/src/config.ts`                                | i18next initialization                                                          |
| `packages/i18n/src/components/I18nProvider.tsx`              | React i18n provider                                                             |
| `apps/server/src/simulation/SimulationEngine.ts`             | In-memory AI game engine                                                        |
| `apps/server/src/simulation/runner.ts`                       | Simulation CLI entry point                                                      |
| `docs/AI_STRATEGY.md`                                        | AI decision strategy docs                                                       |
