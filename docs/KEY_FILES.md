# Key Files

| File                                                         | Purpose                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `packages/shared-types/src/cards.ts`                         | Card types and constants                                                        |
| `packages/shared-types/src/game.ts`                          | Game state and meld types                                                       |
| `packages/shared-types/src/events.ts`                        | Event type definitions                                                          |
| `packages/shared-types/src/errors.ts`                        | Error codes and GameError                                                       |
| `packages/shared-types/src/gameLog.ts`                       | Game log entry types                                                            |
| `packages/shared-types/src/ai.ts`                            | AI player types                                                                 |
| `packages/game-logic/src/state/reducer.ts`                   | Event sourcing reducer                                                          |
| `packages/game-logic/src/state/views.ts`                     | Client-side event filtering (hides opponents' cards in UI)                      |
| `packages/game-logic/src/melds/detector.ts`                  | Meld detection                                                                  |
| `packages/game-logic/src/phases/bidding.ts`                  | Bidding phase logic                                                             |
| `packages/game-logic/src/phases/tricks.ts`                   | Trick-taking rules                                                              |
| `packages/game-logic/src/export/`                            | Event export for debug                                                          |
| `packages/game-logic/src/__tests__/testHelpers.ts`           | Integration test utilities                                                      |
| `packages/game-logic/src/__tests__/roundIntegration.test.ts` | Full round integration test                                                     |
| `packages/ui-shared/src/useGameState.ts`                     | Game state React hook (applies event sourcing reducer)                          |
| `packages/ui-shared/src/useRoundHistory.ts`                  | Round history for scoreboard                                                    |
| `packages/ui-shared/src/useGameLog.ts`                       | Game log entries hook                                                           |
| `packages/ui-shared/src/useActionRequired.ts`                | Your-turn detection hook                                                        |
| `packages/ui-shared/src/useCelebration.ts`                   | Win celebration effects hook                                                    |
| `packages/ui-shared/src/useTrickAnimationState.ts`           | Trick animation phase state machine                                             |
| `apps/client/src/firebase/config.ts`                         | Firebase app initialization                                                     |
| `apps/client/src/firebase/events.ts`                         | Firebase RTDB event read/write (subscribeToEvents, pushEvents, getAllEvents)    |
| `apps/client/src/firebase/session.ts`                        | Firebase RTDB session management (create, join, presence, status)               |
| `apps/client/src/firebase/gameEventFactory.ts`               | Client-side game action validation + event creation                             |
| `apps/client/src/firebase/secretId.ts`                       | secretId generation and SHA-256 hashing                                         |
| `apps/client/src/hooks/useFirebaseGame.ts`                   | Main game hook (Firebase subscriptions, state, reconnection)                    |
| `apps/client/src/hooks/useStorage.ts`                        | Session credential persistence (AsyncStorage / localStorage)                    |
| `packages/game-canvas/src/cards/cardPositions.ts`            | Single source of truth for all card positions (trick, hand, won-pile, opponent) |
| `packages/game-canvas/src/cards/CardView.tsx`                | Animated card with arc flight (initialX/Y)                                      |
| `apps/client/src/components/game/TrickAnimationLayer.tsx`    | Full-screen trick card animation overlay                                        |
| `apps/client/src/components/ui/GameScreen.tsx`               | Main game screen                                                                |
| `packages/game-ai/src/AIPlayer.ts`                           | AI player interface & factory                                                   |
| `packages/game-ai/src/BinokelAIPlayer.ts`                    | AI player decision logic (easy/medium/hard)                                     |
| `packages/game-ai/src/OfflineGameEngine.ts`                  | Offline single-player game engine (human + AI)                                  |
| `apps/client/src/hooks/useOfflineGame.ts`                    | Offline game state hook (wraps OfflineGameEngine for React)                     |
| `apps/server/src/simulation/SimulationEngine.ts`             | In-memory AI game engine (`pnpm simulate`)                                      |
| `apps/server/src/simulation/runner.ts`                       | Simulation CLI entry point                                                      |
| `packages/i18n/src/locales/de.ts`                            | German translations                                                             |
| `packages/i18n/src/locales/en.ts`                            | English translations                                                            |
| `packages/i18n/src/types.ts`                                 | i18n types and config                                                           |
| `packages/i18n/src/config.ts`                                | i18next initialization                                                          |
| `packages/i18n/src/components/I18nProvider.tsx`              | React i18n provider                                                             |
| `docs/AI_STRATEGY.md`                                        | AI decision strategy docs                                                       |
