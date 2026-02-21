# Dabb Deployment Guide

This guide walks you through deploying Dabb to production on a Hetzner CX23 server using OpenTofu for provisioning and GitHub Actions for automated deployments.

## Architecture

```
Internet → nginx:80/443 → web:8080   (static React app)
                        → server:3000 (Node.js + WebSockets)
                          └─ postgres (internal network only)
```

- nginx is the only container exposed externally (ports 80, 443)
- web and server containers stay on the internal Docker network
- PostgreSQL is never exposed outside Docker

## Quick Start (Local Development)

```bash
# Start all services locally
docker compose up -d

# Access the app
# Web: http://localhost:8080
# Server: http://localhost:3000
```

---

## One-Time Setup Sequence

### 1. Generate SSH deploy keypair

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dabb-deploy -C "dabb-github-deploy"
```

- `~/.ssh/dabb-deploy` → GitHub secret `SSH_PRIVATE_KEY`
- `~/.ssh/dabb-deploy.pub` → OpenTofu variable `ssh_public_key`

### 2. Get Hetzner API token

1. Log in at [console.hetzner.cloud](https://console.hetzner.cloud)
2. Go to project → **Security** → **API Tokens** → **Generate API Token**
3. Grant **Read & Write** permissions and copy the token

### 3. Provision server with OpenTofu

[Install OpenTofu](https://opentofu.org/docs/intro/install/) (`brew install opentofu` on macOS), then:

```bash
cd tofu/
tofu init
tofu apply \
  -var="hetzner_api_token=<YOUR_HETZNER_TOKEN>" \
  -var="ssh_public_key=$(cat ~/.ssh/dabb-deploy.pub)"
# Note the output: server_ip = "x.x.x.x"
```

### 4. Create DNS record at Alfahosting

1. Log in at [Alfahosting Kundencenter](https://kundencenter.alfahosting.de)
2. **Meine Verträge** → click the **Multi L** contract
3. **Experten-Einstellungen** → **DNS-System**
4. Select domain **degler.info**
5. Add a new A record:
   - **Hostname**: `dabb` (result: `dabb.degler.info`)
   - **Type**: A
   - **Value**: `<Hetzner server IP from step 3>`
   - **TTL**: 3600
6. Save — DNS propagation takes up to a few hours
7. Verify: `nslookup dabb.degler.info` should return the Hetzner IP

### 5. Copy files to server

```bash
SERVER=dabb@<server-ip>

scp -i ~/.ssh/dabb-deploy docker-compose.prod.yml $SERVER:/opt/dabb/
scp -i ~/.ssh/dabb-deploy -r deploy/ $SERVER:/opt/dabb/

# Create .env with secrets
ssh -i ~/.ssh/dabb-deploy $SERVER "cat > /opt/dabb/.env" <<EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
CLIENT_URL=https://dabb.degler.info
VITE_SERVER_URL=https://dabb.degler.info
EOF
```

### 6. Initialize Let's Encrypt SSL

Wait for DNS to propagate (verify with `nslookup`), then:

```bash
ssh -i ~/.ssh/dabb-deploy $SERVER \
  "cd /opt/dabb && bash deploy/nginx/init-letsencrypt.sh dabb.degler.info"
```

This script:

1. Starts nginx on port 80 to handle the ACME challenge
2. Runs `certbot certonly --webroot` to obtain the certificate
3. Restarts nginx with full HTTPS config

### 7. Add GitHub Secrets

In the GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

| Name                | Value                                |
| ------------------- | ------------------------------------ |
| `SERVER_HOST`       | Hetzner server IP                    |
| `SSH_PRIVATE_KEY`   | Contents of `~/.ssh/dabb-deploy`     |
| `POSTGRES_PASSWORD` | Same password as in `.env` on server |
| `CLIENT_URL`        | `https://dabb.degler.info`           |

Update the existing **variable** `VITE_SERVER_URL` → `https://dabb.degler.info`

### 8. First deployment

Push any change to `main` (or re-run the CI workflow manually). GitHub Actions will:

1. Build and push Docker images to `ghcr.io`
2. Trigger the deploy workflow → SSH in → `docker compose pull && up -d`

---

## Automated Maintenance

| Task                | Frequency            | Automated by        |
| ------------------- | -------------------- | ------------------- |
| SSL renewal         | Every 60 days        | certbot container   |
| OS security patches | Daily                | unattended-upgrades |
| App deployment      | Every push to `main` | GitHub Actions      |
| Downtime alerts     | 5-minute intervals   | UptimeRobot (free)  |

### UptimeRobot setup (optional)

After deployment, add a free monitor at [uptimerobot.com](https://uptimerobot.com):

- **URL**: `https://dabb.degler.info/health`
- **Interval**: 5 minutes
- **Alert**: email on downtime

---

## Cost Summary

| Resource                             | Cost          |
| ------------------------------------ | ------------- |
| Hetzner CX23 (2 vCPU, 4 GB RAM)      | ~€3.49/month  |
| Domain (degler.info via Alfahosting) | Already owned |
| **Total**                            | **~€42/year** |

---

## Environment Variables Reference

| Variable            | Required | Description                           |
| ------------------- | -------- | ------------------------------------- |
| `POSTGRES_PASSWORD` | Yes      | Database password                     |
| `CLIENT_URL`        | Yes      | Web app URL (for CORS)                |
| `VITE_SERVER_URL`   | Yes      | Server URL (built into web app)       |
| `DATABASE_URL`      | No       | Override if using external PostgreSQL |
| `PORT`              | No       | Server port (default: 3000)           |
| `NODE_ENV`          | No       | Environment (default: production)     |

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx

# Check status
docker compose -f docker-compose.prod.yml ps
```

### WebSocket connection fails

- Ensure nginx is forwarding `/socket.io/` with `Upgrade` headers (see `deploy/nginx/nginx.conf`)
- Check `CLIENT_URL` matches the actual web app origin

### SSL certificate not found

- Verify DNS is pointing to the server: `nslookup dabb.degler.info`
- Re-run the init script: `bash deploy/nginx/init-letsencrypt.sh dabb.degler.info`
- Check certbot logs: `docker compose -f docker-compose.prod.yml logs certbot`

### Database connection refused

- Verify PostgreSQL container is running: `docker compose -f docker-compose.prod.yml ps`
- Check `DATABASE_URL` format and `POSTGRES_PASSWORD` in `.env`

---

## Security Checklist

- [x] Strong PostgreSQL password (`openssl rand -base64 32`)
- [x] SSH key authentication (cloud-init disables password auth by default on Hetzner)
- [x] Firewall configured via Hetzner Cloud — only ports 22, 80, 443 open
- [x] SSL/TLS for all public endpoints (Let's Encrypt via certbot)
- [x] Automatic OS security patches (unattended-upgrades)
- [ ] Monitor GitHub Security tab for CVE alerts

---

## Related Documentation

- [Architecture: Deployment View](docs/arc42/07-deployment-view.md)
- [ADR: Deployment Strategy](docs/adr/005-deployment-strategy.md)
- [OpenTofu Documentation](https://opentofu.org/docs/)
- [Hetzner Cloud Docs](https://docs.hetzner.cloud/)
