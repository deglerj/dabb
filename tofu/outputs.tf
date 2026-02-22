output "server_ip" {
  description = "Public IPv4 address of the Hetzner server"
  value       = hcloud_server.dabb.ipv4_address
}
