# 9. Architecture Decisions

See the [Architecture Decision Records](../adr/) for detailed decisions:

| ADR                                          | Title                                    | Status     |
| -------------------------------------------- | ---------------------------------------- | ---------- |
| [001](../adr/001-event-sourcing.md)          | Use Event Sourcing for Game State        | Accepted   |
| [002](../adr/002-monorepo-structure.md)      | Monorepo with pnpm + Turborepo           | Accepted   |
| [003](../adr/003-socket-io.md)               | Socket.IO for Real-time Communication    | Accepted   |
| [004](../adr/004-swabian-terminology.md)     | Use Swabian German Terminology           | Accepted   |
| [005](../adr/005-deployment-strategy.md)     | Oracle Cloud Deployment Strategy         | Superseded |
| [006](../adr/006-database-migrations.md)     | Database Migration System                | Accepted   |
| [007](../adr/007-hetzner-hosting.md)         | Switch Hosting to Hetzner Cloud          | Accepted   |
| [008](../adr/008-opentofu-infrastructure.md) | Infrastructure as Code with OpenTofu     | Accepted   |
| [009](../adr/009-trick-animation-overlay.md) | Full-Screen Overlay for Trick Animations | Accepted   |

## Key Decisions Summary

### Event Sourcing

- All game actions stored as events
- State reconstructed by replaying events
- Enables reconnection and debugging

### Monorepo

- Single repository for all code
- Shared types prevent drift
- Coordinated releases

### Socket.IO

- Mature WebSocket library
- Built-in reconnection
- Room/namespace support

### Swabian Terminology

- Authentic card names (Kreuz, Schippe, Herz, Bollen)
- Authentic rank names (Buabe instead of Unter)
- Regional authenticity

### Database Migrations

- Numbered SQL files tracked in `pgmigrations` table
- Automatic migration on server startup
- Idempotent migrations for safe re-runs

### Hetzner Cloud Hosting

- Migrated from Oracle Cloud Always Free + Coolify (see ADR 005) to Hetzner CX23
- nginx handles TLS termination and reverse proxying
- Certbot container manages automatic SSL renewal

### Infrastructure as Code

- OpenTofu (`tofu/`) provisions the Hetzner server deterministically
- Manages SSH key, firewall, and server instance
- cloud-init bootstraps Docker and system user on first boot
