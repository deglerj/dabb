# ADR 007: Switch Hosting from Oracle Cloud to Hetzner Cloud

## Status

Accepted

## Date

2026-02-21

## Context

[ADR 005](005-deployment-strategy.md) chose Oracle Cloud Always Free + Coolify as the hosting platform. In practice, this approach had several problems:

1. **Oracle Cloud ARM capacity**: Free-tier ARM instances are chronically unavailable — automated retry scripts (`oci-instance-grabber.sh`) were needed just to provision a server
2. **Coolify complexity**: Adds an extra layer (Coolify itself needs to be installed, updated, and managed) that isn't needed for a single-service deployment
3. **Account instability**: Oracle Cloud has a history of terminating free-tier accounts without warning for "Terms of Service" reasons
4. **Hidden complexity**: The "free" tier requires a credit card and OCI-specific tooling (OCI CLI, compartments, VCNs, security lists) with a steep learning curve

Hetzner Cloud offers:

- Simple, predictable pricing (~€3.49/month for CX23: 2 vCPU, 4 GB RAM, 40 GB SSD)
- Instant server provisioning via API — no capacity queuing
- A well-documented API with a mature Terraform/OpenTofu provider
- Reliable uptime with a strong European hosting track record
- Servers in Nuremberg (low latency for German users)

## Decision

We will host Dabb on a **Hetzner CX23** server in Nuremberg, managed directly with Docker Compose and nginx, replacing Oracle Cloud + Coolify.

nginx handles TLS termination and reverse proxying directly, eliminating the need for Coolify as a management layer. Certbot (in a Docker container) handles automatic SSL certificate renewal.

## Rationale

1. **Provisioning reliability**: Hetzner creates servers in seconds via API — no capacity waiting
2. **Operational simplicity**: Fewer moving parts (no Coolify, no OCI compartments/VCNs)
3. **Cost predictability**: Fixed ~€42/year vs "free but may disappear"
4. **European data residency**: Server in Germany, appropriate for a German-language app
5. **Infrastructure as Code**: OpenTofu provisions the server deterministically (see ADR 008)
6. **Native WebSocket support**: Direct nginx proxying of `/socket.io/` with `Upgrade` headers

## Implementation Notes

- Server: `CX23` type, `ubuntu-24.04` image, `nbg1` location (Nuremberg)
- Firewall: only ports 22, 80, 443 open; all other ports blocked at Hetzner level
- Deploy user: `dabb` system user with bash shell, member of `docker` group
  - Must use `/bin/bash` (not `/usr/sbin/nologin`) to allow SSH-based CI deployments
  - SSH `authorized_keys` copied from root during cloud-init
- Docker: installed via official Docker install script (`get.docker.com`), not from Ubuntu repos
  - Ubuntu 24.04's default repos do not include `docker-compose-plugin`; the official Docker apt repository is required
- Passwords: generate with `openssl rand -hex 32` — base64 passwords may contain `#` which breaks PostgreSQL connection URL parsing
- Web container healthcheck: must use `127.0.0.1:8080` not `localhost:8080` — the internal nginx only binds IPv4, but `localhost` resolves to `[::1]` (IPv6) inside Alpine containers

## Consequences

### Positive

- Deterministic, fast provisioning
- No capacity queuing or account termination risk
- Simpler operational model
- Automated deploys via GitHub Actions on every push to `main`

### Negative

- ~€42/year hosting cost (previously free)
- Must manage OS patching (mitigated by `unattended-upgrades`)
- Database backups are self-managed (no managed database service)

### Neutral

- Containers remain portable — could migrate to any Docker host without code changes

## Related

- [ADR 005](005-deployment-strategy.md) — superseded by this decision
- [ADR 008](008-opentofu-infrastructure.md) — OpenTofu for server provisioning
- [07-deployment-view.md](../arc42/07-deployment-view.md) — updated deployment architecture
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — step-by-step setup guide
