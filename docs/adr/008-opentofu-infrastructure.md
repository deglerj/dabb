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
- **Server** (`hcloud_server`): CX23 instance, `nbg1` location

### What OpenTofu does NOT manage

- OS installation: NixOS 25.05 is installed manually via Hetzner ISO image after server creation
- OS configuration: declared in `deploy/nixos/configuration.nix` (users, Docker, firewall, autoUpgrade)
- Docker Compose services (managed by GitHub Actions deploy workflow)
- Application config (`.env` file on server — created manually once)
- DNS records (managed at Alfahosting — no API integration needed)
- SSL certificates (managed by certbot container)

### State management

Terraform state is stored **locally** (`tofu/terraform.tfstate`). This is appropriate for a single-developer hobby project. The state file is gitignored. For a team setup, remote state (e.g. Terraform Cloud, S3 backend) should be considered.

### OS Bootstrap

Unlike the original Ubuntu-based setup, the server runs **NixOS 25.05**, installed manually via Hetzner's ISO image feature after OpenTofu creates the server. NixOS handles all system configuration declaratively:

- Docker is installed and managed via `virtualisation.docker` (with weekly `autoPrune`)
- The `dabb` system user (bash shell, home `/opt/dabb`, `docker` group) is declared in config
- SSH authorized keys are declared directly in the NixOS config
- OS upgrades are automated via `system.autoUpgrade` with `allowReboot = true`

See `deploy/nixos/configuration.nix` for the full configuration and `DEPLOYMENT.md` for the one-time installation sequence.

## Consequences

### Positive

- Server can be recreated in minutes with a single `tofu apply` command
- Firewall rules, server specs, and OS config are version-controlled
- `tofu plan` shows exact changes before applying — safe to review
- Provider lock file (`.terraform.lock.hcl`) pins the Hetzner provider version

### Negative

- Local state file means only one person can run `tofu apply` safely
- OpenTofu must be installed locally (`brew install opentofu` on macOS)
- NixOS must be installed manually via Hetzner ISO after `tofu apply` — there is no automated OS bootstrap step

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
- [deploy/nixos/configuration.nix](../../deploy/nixos/configuration.nix) — NixOS server configuration
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — Full setup sequence
