# 11. Risks and Technical Debt

## 11.1 Risks

| Risk                                  | Probability | Impact | Mitigation                                          |
| ------------------------------------- | ----------- | ------ | --------------------------------------------------- |
| Firebase RTDB storage grows unbounded | Medium      | Medium | Implement session cleanup / TTL rules               |
| Firebase vendor lock-in               | Low         | Medium | Game logic is pure — could migrate to another store |
| Mobile app store rejection            | Medium      | Medium | Follow platform guidelines strictly                 |
| Player cheating via raw RTDB reads    | Low         | Low    | Accepted trade-off for serverless architecture      |

## 11.2 Technical Debt

| Item                | Description                                                                                                   | Priority |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| Mobile Polish       | UI needs optimization for various screen sizes                                                                | Medium   |
| Error Handling      | Better error messages for players                                                                             | Medium   |
| Metrics             | Performance monitoring not implemented                                                                        | Low      |
| ui-shared Migration | Client app has its own useGame.ts/useOfflineGame.ts instead of using @dabb/ui-shared hooks for all game state | Low      |

### Resolved Items

| Item                 | Description                                                           | Resolution Date |
| -------------------- | --------------------------------------------------------------------- | --------------- |
| Test Coverage        | Integration tests for socket handlers added                           | 2026-01-24      |
| AI Opponent          | AI players implemented (BinokelAIPlayer, easy/medium/hard difficulty) | 2026-02         |
| Internationalization | German and English UI support via @dabb/i18n package                  | 2026-02         |

## 11.3 Future Improvements

- **Tournament Mode**: Support for organized play
- **iOS Support**: Expo build for iOS
- **Player Timeouts**: Auto-skip inactive human players in-game
