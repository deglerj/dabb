# ADR 008: Infrastructure as Code with OpenTofu

## Status

Accepted

## Date

2026-02-21

## Context

Server provisioning needs to be reproducible and documented. Without infrastructure as code, the steps to recreate the server live only in documentation and human memory, making disaster recovery slow and error-prone.

### Options Considered

| Option                 | Notes                                                           |
| ---------------------- | --------------------------------------------------------------- |
| **OpenTofu**           | Open-source Terraform fork, MPL 2.0, Linux Foundation governed  |
| HashiCorp Terraform    | BSL license since 2023 — not truly open source                  |
| Pulumi                 | Code-based IaC (Python/TypeScript), steeper setup               |
| Manual (SSH + scripts) | Not reproducible, no state tracking                             |
| Ansible                | Good for configuration management, less suited for provisioning |

## Decision

We will use **OpenTofu** (`tofu/` directory) to provision the Hetzner server. OpenTofu is syntax-identical to Terraform (same HCL, same providers) but is governed by the Linux Foundation under the MPL 2.0 license.

### What OpenTofu manages

- **SSH key** (`hcloud_ssh_key`): the deploy keypair uploaded to Hetzner
- **Firewall** (`hcloud_firewall`): ingress rules for ports 22, 80, 443
- **Server** (`hcloud_server`): CX23 instance with Ubuntu 24.04, cloud-init config

### What OpenTofu does NOT manage

- Docker Compose services (managed by GitHub Actions deploy workflow)
- Application config (`.env` file on server — created manually once)
- DNS records (managed at Alfahosting — no API integration needed)
- SSL certificates (managed by certbot container)

### State management

Terraform state is stored **locally** (`tofu/terraform.tfstate`). This is appropriate for a single-developer hobby project. The state file is gitignored. For a team setup, remote state (e.g. Terraform Cloud, S3 backend) should be considered.

### cloud-init

The server bootstraps itself via `tofu/cloud-init.yml` on first boot:

1. Installs Docker via the official install script (`get.docker.com`) — required because Ubuntu 24.04's default apt repos do not include `docker-compose-plugin`
2. Creates the `dabb` system user with `/bin/bash` shell and home at `/opt/dabb`
3. Copies root's `authorized_keys` to the `dabb` user (Hetzner injects the SSH key into root only)
4. Adds `dabb` to the `docker` group
5. Configures `unattended-upgrades` for automatic OS security patches

## Consequences

### Positive

- Server can be recreated in minutes with a single `tofu apply` command
- Firewall rules, server specs, and OS config are version-controlled
- `tofu plan` shows exact changes before applying — safe to review
- Provider lock file (`.terraform.lock.hcl`) pins the Hetzner provider version

### Negative

- Local state file means only one person can run `tofu apply` safely
- OpenTofu must be installed locally (`brew install opentofu` on macOS)

### Neutral

- cloud-init errors appear as `status: error` even when the `runcmd` section runs successfully — verify with `cloud-init status --long` rather than just the exit code

## Usage

```bash
# Install OpenTofu (macOS)
brew install opentofu

# Provision server
cd tofu/
tofu init
tofu apply \
  -var="hetzner_api_token=<TOKEN>" \
  -var="ssh_public_key=$(cat ~/.ssh/dabb-deploy.pub)"

# Destroy server (when decommissioning)
tofu destroy \
  -var="hetzner_api_token=<TOKEN>" \
  -var="ssh_public_key=$(cat ~/.ssh/dabb-deploy.pub)"
```

## Related

- [ADR 007](007-hetzner-hosting.md) — Hetzner as hosting provider
- [tofu/main.tf](../../tofu/main.tf) — OpenTofu configuration
- [tofu/cloud-init.yml](../../tofu/cloud-init.yml) — Server bootstrap script
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — Full setup sequence
