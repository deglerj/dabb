# 11. Risks and Technical Debt

## 11.1 Risks

| Risk                                    | Probability | Impact | Mitigation                               |
| --------------------------------------- | ----------- | ------ | ---------------------------------------- |
| Event storage grows unbounded           | Medium      | Medium | Implement event compaction / archival    |
| Socket.IO scalability limits            | Low         | High   | Use Redis adapter for horizontal scaling |
| Mobile app store rejection              | Medium      | Medium | Follow platform guidelines strictly      |
| Player cheating via client modification | Low         | Medium | Server-side validation of all moves      |

## 11.2 Technical Debt

| Item                | Description                                                                                  | Priority |
| ------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Test Coverage       | Integration tests missing for socket handlers                                                | High     |
| Mobile Polish       | UI needs optimization for various screen sizes                                               | Medium   |
| Error Handling      | Better error messages for players                                                            | Medium   |
| Logging             | Structured logging for production debugging                                                  | Low      |
| Metrics             | Performance monitoring not implemented                                                       | Low      |
| ui-shared Migration | Web and mobile apps have duplicated socket/state logic that should use @dabb/ui-shared hooks | Low      |

## 11.3 Future Improvements

- **AI Opponent**: Single-player mode with AI
- **Tournament Mode**: Support for organized play
- **Internationalization**: Support for multiple languages
- **iOS Support**: Expo build for iOS
