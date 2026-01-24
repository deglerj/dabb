# 7. Deployment View

## 7.1 Infrastructure Overview

```plantuml
@startuml
!theme plain

node "Client Device" {
  [Web Browser] as browser
  [Android App] as android
}

cloud "Internet" {
}

node "Oracle Cloud (Always Free)" {
  node "ARM Instance (4 vCPU, 24GB RAM)" {
    [Coolify / Docker Compose] as orchestrator
    [nginx (Web)] as web
    [Node.js Server] as server
    database "PostgreSQL" as db
  }
}

browser --> Internet
android --> Internet
Internet --> web : HTTPS (8080)
Internet --> server : Socket.IO (3000)
web --> server : Internal
server --> db : TCP (5432)

@enduml
```

## 7.2 Deployment Options

### Option A: Oracle Cloud + Coolify (Recommended)

**Cost:** Free (Always Free tier)
**Vendor Lock-in:** None (standard Docker containers)

Oracle Cloud provides generous Always Free resources:

- 4 ARM vCPUs, 24GB RAM (split across up to 4 instances)
- 200GB block storage
- Free Kubernetes control plane

Coolify provides a Heroku-like PaaS experience on your own infrastructure.

### Option B: Oracle Cloud + Docker Compose

Direct Docker Compose deployment without Coolify for simpler setups.

### Option C: Other Cloud Providers

The Docker images are portable and can be deployed to:

- **Fly.io**: 3GB RAM free, good for WebSocket apps
- **Google Cloud Run**: Scale-to-zero, pay per request
- **Render**: 750 hours/month free
- **Any VPS**: Hetzner, DigitalOcean, Linode, etc.

## 7.3 Container Architecture

### Server Container (`dabb-server`)

```dockerfile
FROM node:22-alpine
# Multi-stage build with non-root user
# Health check on /health endpoint
# Node.js runtime
EXPOSE 3000
```

### Web Container (`dabb-web`)

```dockerfile
FROM node:22-alpine AS builder     # Build stage
FROM nginx:alpine                   # Production stage
# Static SPA with security headers
# Gzip compression enabled
EXPOSE 8080
```

### Database

- PostgreSQL 16 (Alpine)
- Persistent volume for data
- Internal network only (not exposed)

## 7.4 Environment Variables

| Variable            | Required | Description                 | Example                                 |
| ------------------- | -------- | --------------------------- | --------------------------------------- |
| `DATABASE_URL`      | Yes      | PostgreSQL connection       | `postgresql://user:pass@host:5432/dabb` |
| `PORT`              | No       | Server port (default: 3000) | `3000`                                  |
| `CLIENT_URL`        | Yes      | Web app URL for CORS        | `https://dabb.example.com`              |
| `NODE_ENV`          | No       | Environment                 | `production`                            |
| `VITE_SERVER_URL`   | Yes      | Server URL for frontend     | `https://api.dabb.example.com`          |
| `POSTGRES_PASSWORD` | Yes      | Database password           | `secure_random_string`                  |

## 7.5 CI/CD Pipeline

```
┌─────────────┐   ┌──────────┐   ┌────────────────┐   ┌─────────────┐
│  Push/PR    │ → │  Build   │ → │ Security Scan  │ → │ Push Image  │
│  to main    │   │  & Test  │   │ (Trivy + Audit)│   │ to GHCR     │
└─────────────┘   └──────────┘   └────────────────┘   └─────────────┘
```

Security scanning includes:

- OSV Scanner for dependency vulnerabilities
- Trivy for container image CVEs
- Results uploaded to GitHub Security tab

## 7.6 Deployment Commands

### Local Development

```bash
docker compose up -d
# Web: http://localhost:8080
# Server: http://localhost:3000
```

### Production

```bash
# Set environment variables
export POSTGRES_PASSWORD=secure_password
export CLIENT_URL=https://dabb.example.com
export VITE_SERVER_URL=https://api.dabb.example.com

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

### Using Coolify

1. Add Git repository in Coolify dashboard
2. Configure environment variables
3. Set build path and Dockerfile location
4. Deploy

## 7.7 Health Checks

| Service    | Endpoint      | Interval | Timeout |
| ---------- | ------------- | -------- | ------- |
| Server     | `GET /health` | 30s      | 3s      |
| Web        | `GET /`       | 30s      | 3s      |
| PostgreSQL | `pg_isready`  | 10s      | 5s      |

## 7.8 Scaling Considerations

For low-traffic (target use case):

- Single instance of each service is sufficient
- PostgreSQL connection pooling not required
- No load balancer needed

For higher traffic:

- Add reverse proxy (Traefik/nginx) for SSL termination
- Consider managed PostgreSQL (Neon, Supabase)
- Horizontal scaling via Docker Swarm or Kubernetes

## 7.9 Backup Strategy

### Database Backups

```bash
# Manual backup
docker exec dabb-postgres pg_dump -U dabb dabb > backup.sql

# Restore
docker exec -i dabb-postgres psql -U dabb dabb < backup.sql
```

Recommended: Set up automated daily backups with retention policy.

## 7.10 Monitoring

Basic monitoring via Docker health checks. For production, consider:

- Uptime monitoring (UptimeRobot, Healthchecks.io - both have free tiers)
- Log aggregation (Loki, or simple file logging)
- Metrics (Prometheus + Grafana if needed)
