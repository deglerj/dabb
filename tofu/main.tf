terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.49"
    }
  }
}
# Note: this file uses OpenTofu (tofu CLI), not the HashiCorp Terraform CLI.
# OpenTofu is syntax-compatible — same HCL, same providers.

provider "hcloud" {
  token = var.hetzner_api_token
}

resource "hcloud_ssh_key" "deploy" {
  name       = "dabb-deploy"
  public_key = var.ssh_public_key
}

resource "hcloud_firewall" "dabb" {
  name = "dabb-firewall"
  rule {
    direction  = "in"
    port       = "22"
    protocol   = "tcp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    port       = "80"
    protocol   = "tcp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    port       = "443"
    protocol   = "tcp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "dabb" {
  name         = "dabb"
  server_type  = "cx23"
  image        = "ubuntu-24.04"
  location     = "nbg1" # Nuremberg, Germany
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.dabb.id]
  user_data    = file("${path.module}/cloud-init.yml")
}

