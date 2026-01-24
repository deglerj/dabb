# Dabb Deployment Guide

This guide walks you through deploying Dabb to production using Oracle Cloud's Always Free tier with Coolify or Docker Compose.

The application runs on **Node.js** with **pnpm** for dependency management.

## Quick Start (Local Development)

```bash
# Start all services locally
docker compose up -d

# Access the app
# Web: http://localhost:8080
# Server: http://localhost:3000
```

---

## Manual Setup Tasks Checklist

### Phase 1: Account Setup

- [ ] **Create Oracle Cloud account**
  - Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
  - Sign up for Always Free tier (requires credit card for verification, won't be charged)
  - Select your home region (closest to your users)

- [ ] **Enable GitHub Container Registry**
  - Ensure your GitHub repository is set up
  - Container images will be pushed to `ghcr.io/<username>/dabb-server` and `ghcr.io/<username>/dabb-web`

### Phase 2: Oracle Cloud Infrastructure Setup

- [ ] **Create a compartment** (optional but recommended)
  - Identity & Security → Compartments → Create Compartment
  - Name: `dabb`

- [ ] **Create VCN (Virtual Cloud Network)**
  - Networking → Virtual Cloud Networks → Start VCN Wizard
  - Choose "Create VCN with Internet Connectivity"
  - Name: `dabb-vcn`

- [ ] **Open firewall ports in Security List**
  - VCN → Security Lists → Default Security List
  - Add Ingress Rules:
    | Port | Protocol | Source | Description |
    |------|----------|--------|-------------|
    | 80 | TCP | 0.0.0.0/0 | HTTP |
    | 443 | TCP | 0.0.0.0/0 | HTTPS |
    | 3000 | TCP | 0.0.0.0/0 | Server API |
    | 8000 | TCP | 0.0.0.0/0 | Coolify (optional) |
    | 8080 | TCP | 0.0.0.0/0 | Web App |

- [ ] **Create ARM Compute Instance**
  - Compute → Instances → Create Instance
  - Shape: `VM.Standard.A1.Flex` (ARM)
  - OCPUs: 2-4 (adjust based on needs)
  - Memory: 12-24 GB
  - Image: Ubuntu 22.04 (or latest LTS)
  - Add SSH key (generate one if needed)
  - Note: If you get "Out of capacity" error, try different availability domain or try again later

- [ ] **Note the public IP address**
  - You'll need this for DNS and SSH access

### Phase 3: Domain Setup (Optional but Recommended)

- [ ] **Register a domain** (if you don't have one)
  - Options: Cloudflare Registrar, Namecheap, Porkbun, etc.

- [ ] **Configure DNS records**
      | Type | Name | Value |
      |------|------|-------|
      | A | @ | `<instance-public-ip>` |
      | A | api | `<instance-public-ip>` |
      | A | coolify | `<instance-public-ip>` |

### Phase 4: Server Setup

- [ ] **SSH into your instance**

  ```bash
  ssh ubuntu@<instance-public-ip>
  ```

- [ ] **Run the setup script**

  ```bash
  # From your local machine, run:
  ssh ubuntu@<instance-public-ip> 'bash -s' < deploy/oracle-cloud-setup.sh
  ```

  Or manually:

  ```bash
  # Update system
  sudo apt update && sudo apt upgrade -y

  # Install Docker
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER

  # Log out and back in for group changes
  exit
  ssh ubuntu@<instance-public-ip>

  # Install Coolify
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
  ```

- [ ] **Configure iptables firewall**
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
  sudo netfilter-persistent save
  ```

### Phase 5: Deploy with Coolify

- [ ] **Access Coolify dashboard**
  - Go to `http://<instance-public-ip>:8000`
  - Create admin account

- [ ] **Add your server as a resource**
  - Servers → Add Server → Localhost

- [ ] **Create a new project**
  - Projects → Add Project → Name: `dabb`

- [ ] **Add PostgreSQL database**
  - Resources → Add Resource → Database → PostgreSQL
  - Configure:
    - Database: `dabb`
    - User: `dabb`
    - Password: (generate secure password)
  - Note the internal connection string

- [ ] **Add Server application**
  - Resources → Add Resource → Application → Docker Compose
  - Git repository: Your GitHub repo URL
  - Branch: `main`
  - Docker Compose file: `docker-compose.prod.yml`
  - Or: Use Dockerfile at `apps/server/Dockerfile`

- [ ] **Configure environment variables**
  - Settings → Environment Variables

  ```
  DATABASE_URL=postgresql://dabb:<password>@<postgres-container>:5432/dabb
  CLIENT_URL=https://your-domain.com
  NODE_ENV=production
  ```

- [ ] **Add Web application**
  - Similar process, use `apps/web/Dockerfile`
  - Build argument: `VITE_SERVER_URL=https://api.your-domain.com`

- [ ] **Configure SSL certificates**
  - Coolify auto-provisions Let's Encrypt certificates
  - Ensure domains are correctly configured

- [ ] **Deploy!**
  - Click Deploy on each resource

### Phase 5 (Alternative): Deploy with Docker Compose

If not using Coolify:

- [ ] **Copy files to server**

  ```bash
  scp docker-compose.prod.yml ubuntu@<ip>:/opt/dabb/
  scp deploy/.env.example ubuntu@<ip>:/opt/dabb/.env
  ```

- [ ] **Configure environment**

  ```bash
  ssh ubuntu@<ip>
  cd /opt/dabb
  nano .env  # Edit with your values
  ```

- [ ] **Deploy**

  ```bash
  docker compose -f docker-compose.prod.yml up -d
  ```

- [ ] **Set up reverse proxy for SSL** (if needed)
  - Install Caddy or Traefik for automatic HTTPS

### Phase 6: Post-Deployment

- [ ] **Verify deployment**
  - Web app loads at your domain
  - Can create/join games
  - WebSocket connection works (real-time updates)

- [ ] **Set up monitoring** (optional)
  - Create free account at [uptimerobot.com](https://uptimerobot.com)
  - Add monitors for:
    - `https://your-domain.com` (web)
    - `https://api.your-domain.com/health` (server)

- [ ] **Set up database backups**

  ```bash
  # Add to crontab for daily backups
  0 3 * * * docker exec dabb-postgres pg_dump -U dabb dabb | gzip > /opt/dabb/backups/dabb-$(date +\%Y\%m\%d).sql.gz
  ```

- [ ] **Configure GitHub repository variables** (for CI/CD)
  - Repository → Settings → Secrets and Variables → Variables
  - Add: `VITE_SERVER_URL` = `https://api.your-domain.com`

---

## Environment Variables Reference

| Variable            | Required | Description                       |
| ------------------- | -------- | --------------------------------- |
| `DATABASE_URL`      | Yes      | PostgreSQL connection string      |
| `CLIENT_URL`        | Yes      | Web app URL (for CORS)            |
| `VITE_SERVER_URL`   | Yes      | Server URL (built into web app)   |
| `POSTGRES_PASSWORD` | Yes      | Database password                 |
| `PORT`              | No       | Server port (default: 3000)       |
| `NODE_ENV`          | No       | Environment (default: production) |

---

## Troubleshooting

### "Out of Host Capacity" error on Oracle Cloud

- ARM instances are in high demand
- Try a different availability domain
- Try creating instance at off-peak hours (early morning)
- Consider upgrading to Pay-As-You-Go (you still won't be charged within free limits)

### Container won't start

```bash
# Check logs
docker compose logs -f server
docker compose logs -f web

# Check health
docker compose ps
```

### WebSocket connection fails

- Ensure port 3000 is open in Oracle Cloud security list
- Ensure iptables allows the port
- Check `CLIENT_URL` matches the actual web app origin

### Database connection refused

- Verify PostgreSQL container is running: `docker compose ps`
- Check `DATABASE_URL` format
- Ensure internal Docker network connectivity

---

## Security Checklist

- [ ] Strong PostgreSQL password (use `openssl rand -base64 32`)
- [ ] SSH key authentication only (disable password auth)
- [ ] Firewall configured (only necessary ports open)
- [ ] SSL/TLS enabled for all public endpoints
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Monitor GitHub Security tab for CVE alerts

---

## Cost Summary

| Resource                   | Cost                    |
| -------------------------- | ----------------------- |
| Oracle Cloud ARM Instance  | Free (Always Free)      |
| Oracle Cloud Block Storage | Free (up to 200GB)      |
| Oracle Cloud Bandwidth     | Free (up to 10TB/month) |
| Domain (optional)          | ~$10-15/year            |
| **Total**                  | **$0 - $15/year**       |

---

## Related Documentation

- [Architecture: Deployment View](docs/arc42/07-deployment-view.md)
- [ADR: Deployment Strategy](docs/adr/005-deployment-strategy.md)
- [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [Coolify Documentation](https://coolify.io/docs/)
