# 9. Architecture Decisions

See the [Architecture Decision Records](../adr/) for detailed decisions:

| ADR                                                | Title                                    | Status     |
| -------------------------------------------------- | ---------------------------------------- | ---------- |
| [001](../adr/001-event-sourcing.md)                | Use Event Sourcing for Game State        | Accepted   |
| [002](../adr/002-monorepo-structure.md)            | Monorepo with pnpm + Turborepo           | Accepted   |
| [003](../adr/003-socket-io.md)                     | Socket.IO for Real-time Communication    | Superseded |
| [004](../adr/004-swabian-terminology.md)           | Use Swabian German Terminology           | Accepted   |
| [005](../adr/005-deployment-strategy.md)           | Oracle Cloud Deployment Strategy         | Superseded |
| [006](../adr/006-database-migrations.md)           | Database Migration System                | Accepted   |
| [007](../adr/007-hetzner-hosting.md)               | Switch Hosting to Hetzner Cloud          | Superseded |
| [008](../adr/008-opentofu-infrastructure.md)       | Infrastructure as Code with OpenTofu     | Superseded |
| [009](../adr/009-trick-animation-overlay.md)       | Full-Screen Overlay for Trick Animations | Accepted   |
| [010](../adr/010-custom-dev-build-over-expo-go.md) | Custom Dev Build Instead of Expo Go      | Accepted   |

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

### Custom Dev Build (ADR 010)

- `@shopify/react-native-skia` (v2+) and `react-native-reanimated` v4 require native modules absent from Expo Go
- Developers build a custom APK once via `./dev.sh apk`; subsequent JS changes hot-reload via Metro
