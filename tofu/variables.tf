variable "hetzner_api_token" {
  description = "Hetzner Cloud API token (Read & Write)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key to install on the server for the dabb deploy user"
  type        = string
}
