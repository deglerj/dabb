#!/bin/bash
# Oracle Cloud Infrastructure (OCI) setup script for Dabb
# This script sets up Docker and Coolify on an Oracle Cloud ARM instance
#
# Prerequisites:
# - Oracle Cloud account with Always Free tier
# - ARM instance (VM.Standard.A1.Flex) provisioned
# - SSH access to the instance
#
# Usage: ssh ubuntu@<instance-ip> 'bash -s' < oracle-cloud-setup.sh

set -euo pipefail

echo "=== Dabb Oracle Cloud Setup ==="
echo ""

# Update system
echo "[1/6] Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes."
else
    echo "Docker already installed."
fi

# Install Docker Compose plugin
echo "[3/6] Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
else
    echo "Docker Compose already installed."
fi

# Configure firewall
echo "[4/6] Configuring firewall..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save

# Create app directory
echo "[5/6] Creating application directory..."
sudo mkdir -p /opt/dabb
sudo chown $USER:$USER /opt/dabb

# Install Coolify (optional - comment out if using docker-compose directly)
echo "[6/6] Installing Coolify..."
if [ "${INSTALL_COOLIFY:-true}" = "true" ]; then
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
    echo ""
    echo "Coolify installed! Access it at: http://<your-instance-ip>:8000"
    echo "Default port: 8000"
else
    echo "Skipping Coolify installation (INSTALL_COOLIFY=false)"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for Docker group membership)"
echo "2. Copy your docker-compose.prod.yml to /opt/dabb/"
echo "3. Create a .env file with your configuration"
echo "4. Run: cd /opt/dabb && docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Or if using Coolify:"
echo "1. Access Coolify at http://<your-ip>:8000"
echo "2. Add your Git repository"
echo "3. Configure environment variables"
echo "4. Deploy!"
