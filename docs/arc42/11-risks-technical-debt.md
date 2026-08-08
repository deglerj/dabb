# 11. Risks and Technical Debt

## 11.1 Risks

| Risk                                                                                                                               | Probability | Impact | Mitigation                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Firebase RTDB storage grows unbounded                                                                                              | Medium      | Medium | Implement session cleanup / TTL rules                                                                             |
| Firebase vendor lock-in                                                                                                            | Low         | Medium | Game logic is pure — could migrate to another store                                                               |
| iOS PWA limitations (no `navigator.vibrate`, no install prompt, `localStorage` eviction after 7 days idle for non-installed sites) | Low         | Low    | Haptics row hidden when unsupported; in-app install instructions; installed PWAs are exempt from storage eviction |
| Player cheating via raw RTDB reads                                                                                                 | Low         | Low    | Accepted trade-off for serverless architecture                                                                    |

## 11.2 Technical Debt

| Item                | Description                                                                                                                 | Priority |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| Mobile Polish       | UI needs optimization for various screen sizes                                                                              | Medium   |
| Error Handling      | Better error messages for players                                                                                           | Medium   |
| Metrics             | Performance monitoring not implemented                                                                                      | Low      |
| ui-shared Migration | Client app has its own useGame.ts/useOfflineGame.ts instead of using @dabb/ui-shared hooks for all game state               | Low      |
| rn-compat Surface   | New RN-shaped components/style properties used in future work need a matching shim entry in `@dabb/rn-compat` (see ADR 011) | Low      |

### Resolved Items

| Item                 | Description                                                           | Resolution Date |
| -------------------- | --------------------------------------------------------------------- | --------------- |
| Test Coverage        | Integration tests for socket handlers added                           | 2026-01-24      |
| AI Opponent          | AI players implemented (BinokelAIPlayer, easy/medium/hard difficulty) | 2026-02         |
| Internationalization | German and English UI support via @dabb/i18n package                  | 2026-02         |

## 11.3 Future Improvements

- **Tournament Mode**: Support for organized play
- **Player Timeouts**: Auto-skip inactive human players in-game
