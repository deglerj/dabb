# Dabb Architecture Documentation

This documentation follows the [Arc42](https://arc42.org/) template for software architecture documentation.

## Table of Contents

1. [Introduction and Goals](01-introduction-goals.md)
2. [Constraints](02-constraints.md)
3. [Context and Scope](03-context-scope.md)
4. [Solution Strategy](04-solution-strategy.md)
5. [Building Block View](05-building-block-view.md)
6. [Runtime View](06-runtime-view.md)
7. [Deployment View](07-deployment-view.md)
8. [Crosscutting Concepts](08-crosscutting-concepts.md)
9. [Architecture Decisions](09-architecture-decisions.md)
10. [Quality Requirements](10-quality-requirements.md)
11. [Risks and Technical Debt](11-risks-technical-debt.md)
12. [Glossary](12-glossary.md)

---

## Quick Overview

**Dabb** is a multiplayer implementation of the traditional Swabian card game Binokel. It features:

- Real-time multiplayer gameplay via Socket.IO
- Event-sourced game state for reliability
- Cross-platform clients (Web + Android)
- TypeScript monorepo architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Web App    │  │  Mobile App  │  │    (Future)  │       │
│  │   (React)    │  │   (Expo)     │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  │ Socket.IO                                 │
│         ┌────────▼────────┐                                  │
│         │     Server      │                                  │
│         │   (Express +    │                                  │
│         │   Socket.IO)    │                                  │
│         └────────┬────────┘                                  │
│                  │                                           │
│         ┌────────▼────────┐                                  │
│         │   PostgreSQL    │                                  │
│         │   (Events +     │                                  │
│         │   Sessions)     │                                  │
│         └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```
