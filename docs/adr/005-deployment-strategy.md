# ADR 005: Deployment Strategy

## Status

Accepted

## Date

2026-01-23

## Context

We need to deploy Dabb (server + web app + database) in a way that:

1. **Costs nothing** for a low-traffic hobby project
2. **Avoids vendor lock-in** - should be portable to any infrastructure
3. **Is simple to maintain** - minimal operational overhead
4. **Supports WebSocket connections** for real-time gameplay

### Options Considered

| Option | Free Tier | Vendor Lock-in | WebSocket Support | Complexity |
|--------|-----------|----------------|-------------------|------------|
| **Oracle Cloud + Coolify** | 4 vCPU, 24GB RAM | None | Yes | Low |
| Railway | $5 credit only | Medium | Yes | Very Low |
| Fly.io | 3GB RAM, 160 GB-hr | Low | Yes | Medium |
| Google Cloud Run | Scale-to-zero | Medium | Limited | Medium |
| Render | 750 hrs/month | Low | Yes | Low |
| Vercel + External DB | Frontend only | Medium | N/A | Medium |

## Decision

We will use **Docker containers** as the primary deployment unit, with **Oracle Cloud Always Free + Coolify** as the recommended hosting platform.

### Rationale

1. **Docker provides portability**: Standard OCI containers can run anywhere - Oracle, AWS, Hetzner, home server, etc.

2. **Oracle Cloud's free tier is unmatched**: 4 ARM vCPUs + 24GB RAM forever free is significantly more than any other provider.

3. **Coolify reduces operational burden**: Provides Git-based deployments, automatic SSL, and a web UI without SaaS lock-in (it's self-hosted).

4. **Multi-architecture builds**: CI builds both `linux/amd64` and `linux/arm64` images, supporting both Oracle's ARM instances and traditional x86 servers.

5. **Bun runtime**: Faster startup, lower memory usage than Node.js

6. **Security by default**:
   - Non-root container users
   - Trivy CVE scanning in CI
   - OSV Scanner for dependency vulnerabilities
   - Security headers in nginx config

## Consequences

### Positive

- Zero hosting costs for low-traffic usage
- Can migrate to any Docker-compatible host without code changes
- Consistent development and production environments
- Security vulnerabilities caught before deployment

### Negative

- ARM image builds require cross-compilation (handled by Docker buildx)
- Oracle Cloud ARM instances can be hard to provision (high demand)
- Coolify adds a layer of abstraction that may complicate debugging

### Neutral

- Need to manage infrastructure (vs fully managed PaaS)
- Database backups are manual unless automated

## Alternatives for Future

If requirements change:

- **Higher traffic**: Add Traefik reverse proxy, consider managed PostgreSQL
- **Team collaboration**: Consider Railway or Render for simpler onboarding
- **Edge deployment**: Fly.io for multi-region WebSocket distribution
- **Kubernetes**: Use Oracle's free OKE control plane with ARM worker nodes

## Related

- [07-deployment-view.md](../arc42/07-deployment-view.md) - Detailed deployment architecture
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Step-by-step setup guide
