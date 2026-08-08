# 9. Architecture Decisions

See the [Architecture Decision Records](../adr/) for detailed decisions:

| ADR                                          | Title                                    | Status     |
| -------------------------------------------- | ---------------------------------------- | ---------- |
| [001](../adr/001-event-sourcing.md)          | Use Event Sourcing for Game State        | Accepted   |
| [002](../adr/002-monorepo-structure.md)      | Monorepo with pnpm + Turborepo           | Accepted   |
| [003](../adr/003-socket-io.md)               | Socket.IO for Real-time Communication    | Superseded |
| [004](../adr/004-swabian-terminology.md)     | Use Swabian German Terminology           | Accepted   |
| [005](../adr/005-deployment-strategy.md)     | Oracle Cloud Deployment Strategy         | Superseded |
| [006](../adr/006-database-migrations.md)     | Database Migration System                | Accepted   |
| [007](../adr/007-hetzner-hosting.md)         | Switch Hosting to Hetzner Cloud          | Superseded |
| [008](../adr/008-opentofu-infrastructure.md) | Infrastructure as Code with OpenTofu     | Superseded |
| [009](../adr/009-trick-animation-overlay.md) | Full-Screen Overlay for Trick Animations | Accepted   |
| 010 (deleted, moot — see ADR 011)            | Custom Dev Build Instead of Expo Go      | Superseded |
| [011](../adr/011-pwa-instead-of-native.md)   | Retire Native Android/iOS, Ship as PWA   | Accepted   |

## Key Decisions Summary

### Event Sourcing

- All game actions stored as events
- State reconstructed by replaying events
- Enables reconnection and debugging

### Monorepo

- Single repository for all code
- Shared types prevent drift
- Coordinated releases

### Firebase Realtime Database (supersedes Socket.IO)

- Serverless P2P — no application server to maintain
- All game events stored as append-only log per session
- Clients subscribe directly; reconnection handled by replaying all events
- Write access gated by secretHash security rules

### Swabian Terminology

- Authentic card names (Kreuz, Schippe, Herz, Bollen)
- Authentic rank names (Buabe instead of Unter)
- Regional authenticity

### Alfahosting SFTP (supersedes Hetzner + OpenTofu)

- Static web client deployed via SFTP after each CI pass on main
- Firebase RTDB replaces all server-side state — no VPS needed
- Build-time env vars bake Firebase config into the web bundle

### PWA Instead of Native (ADR 011, supersedes ADR 010)

- Android and iOS native apps retired; the client ships as a single installable PWA (Vite + a web app manifest + service worker) served from the same web deploy pipeline
- React Native/Expo removed entirely, not just the native build tooling — `@dabb/rn-compat` provides just enough of the RN component surface for the existing JSX to keep working unchanged
- Google Play listing unpublished manually; no farewell release
