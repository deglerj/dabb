# 11. Risks and Technical Debt

## 11.1 Risks

| Risk                                    | Probability | Impact | Mitigation                               |
| --------------------------------------- | ----------- | ------ | ---------------------------------------- |
| Event storage grows unbounded           | Medium      | Medium | Implement event compaction / archival    |
| Socket.IO scalability limits            | Low         | High   | Use Redis adapter for horizontal scaling |
| Mobile app store rejection              | Medium      | Medium | Follow platform guidelines strictly      |
| Player cheating via client modification | Low         | Medium | Server-side validation of all moves      |

## 11.2 Technical Debt

| Item                | Description                                                                                                   | Priority |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| Mobile Polish       | UI needs optimization for various screen sizes                                                                | Medium   |
| Error Handling      | Better error messages for players                                                                             | Medium   |
| Metrics             | Performance monitoring not implemented                                                                        | Low      |
| ui-shared Migration | Web app has its own useGame.ts instead of using @dabb/ui-shared hooks; mobile duplicates useSocket.ts locally | Low      |

### Resolved Items

| Item          | Description                                 | Resolution Date |
| ------------- | ------------------------------------------- | --------------- |
| Test Coverage | Integration tests for socket handlers added | 2026-01-24      |

## 11.3 Future Improvements

- **AI Opponent**: Single-player mode with AI
- **Tournament Mode**: Support for organized play
- **Internationalization**: Support for multiple languages
- **iOS Support**: Expo build for iOS
