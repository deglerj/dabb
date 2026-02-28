# Dabb Deployment Guide

This guide walks you through deploying Dabb to production on a Hetzner CX23 server using OpenTofu for provisioning and GitHub Actions for automated deployments.

## Architecture

```
Internet → nginx:80/443 → web:8080    (static React app)
                        → server:3000  (Node.js + WebSockets)
                        → /umami/      (Umami analytics dashboard)
                          └─ postgres  (internal network only)
                             ├─ dabb   (game database)
                             └─ umami  (analytics database)
```

- nginx is the only container exposed externally (ports 80, 443)
- web and server containers stay on the internal Docker network
- PostgreSQL is never exposed outside Docker
- Umami analytics runs on the internal network, accessed via `/umami/` nginx proxy

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
# IMPORTANT: use openssl rand -hex (not -base64) — base64 output can contain '#'
# which breaks PostgreSQL connection URL parsing.
ssh -i ~/.ssh/dabb-deploy $SERVER "cat > /opt/dabb/.env" <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
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

### 7. Configure Umami Analytics (optional)

After the first deployment, set up Umami for usage tracking:

1. **Login to Umami** at `https://dabb.degler.info/umami/`
   - Default credentials: `admin` / `umami`
   - **Change the password immediately** (Settings → Profile)

2. **Add a website** in Umami:
   - Click **Settings** → **Websites** → **Add website**
   - Name: `Dabb`, Domain: `dabb.degler.info`
   - Copy the **Website ID** (a UUID)

3. **Set environment variables** on the server:

```bash
# Add to /opt/dabb/.env:
UMAMI_APP_SECRET=$(openssl rand -hex 32)
UMAMI_WEBSITE_ID=<paste-website-id-here>
VITE_UMAMI_URL=https://dabb.degler.info/umami
VITE_UMAMI_WEBSITE_ID=<paste-website-id-here>
```

4. **Rebuild and redeploy** to apply:

```bash
cd /opt/dabb && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --build
```

> **Note**: `VITE_UMAMI_URL` and `VITE_UMAMI_WEBSITE_ID` are baked into the web app at build time. They can also be set as GitHub Actions variables so the CI build includes them automatically.

#### Existing installation — create umami database manually

If postgres already has data (no fresh volume), create the umami database manually:

```bash
docker exec -it dabb-postgres psql -U dabb -c "CREATE DATABASE umami;"
```

Then restart the umami container: `docker compose -f docker-compose.prod.yml restart umami`

### 8. Add GitHub Secrets

The deploy workflow uses `environment: production`, so secrets must be added to the
**`production` environment** — not as repository secrets.

1. Go to **Settings** → **Environments** → **production** (create it if it doesn't exist)
2. Add these secrets inside the environment:

| Name                | Value                                |
| ------------------- | ------------------------------------ |
| `SERVER_HOST`       | Hetzner server IP                    |
| `SSH_PRIVATE_KEY`   | Contents of `~/.ssh/dabb-deploy`     |
| `POSTGRES_PASSWORD` | Same password as in `.env` on server |
| `CLIENT_URL`        | `https://dabb.degler.info`           |

The variable `VITE_SERVER_URL` is not sensitive — add/update it as a regular **repository
variable** under **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.

### 9. First deployment

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

| Variable                | Required | Description                                       |
| ----------------------- | -------- | ------------------------------------------------- |
| `POSTGRES_PASSWORD`     | Yes      | Database password                                 |
| `CLIENT_URL`            | Yes      | Web app URL (for CORS)                            |
| `VITE_SERVER_URL`       | Yes      | Server URL (built into web app)                   |
| `UMAMI_APP_SECRET`      | Yes\*    | Umami JWT secret (`openssl rand -hex 32`)         |
| `DATABASE_URL`          | No       | Override if using external PostgreSQL             |
| `PORT`                  | No       | Server port (default: 3000)                       |
| `NODE_ENV`              | No       | Environment (default: production)                 |
| `UMAMI_WEBSITE_ID`      | No       | Umami website ID for server-side event tracking   |
| `VITE_UMAMI_URL`        | No       | Public Umami URL baked into web app at build time |
| `VITE_UMAMI_WEBSITE_ID` | No       | Website ID baked into web app at build time       |

\*Required if the `umami` service is enabled in docker-compose.

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
