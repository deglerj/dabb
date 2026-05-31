# 2. Constraints

## 2.1 Technical Constraints

| Constraint       | Background                                                |
| ---------------- | --------------------------------------------------------- |
| TypeScript       | Chosen for type safety across all packages                |
| pnpm + Turborepo | Monorepo tooling for shared code                          |
| Firebase RTDB    | Serverless P2P backend; append-only event log per session |
| React 19         | Modern React with compiler optimizations                  |
| Expo             | React Native framework for mobile development             |

## 2.2 Organizational Constraints

| Constraint     | Background                               |
| -------------- | ---------------------------------------- |
| Open Source    | CC BY-NC 4.0 License, publicly available |
| Small Team     | Designed for solo/small team development |
| Cost-effective | Prefer free/cheap hosting solutions      |

## 2.3 Conventions

| Convention      | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| Swabian German  | Use Swabian terminology for cards (Kreuz, Schippe, Herz, Bollen) |
| Event Sourcing  | All game state changes are events                                |
| Monorepo        | Shared types and logic across apps                               |
| Component-based | React components for UI                                          |
