#!/bin/bash
# One-time script to obtain the initial Let's Encrypt certificate.
# Run this on the server after DNS is pointed to the Hetzner IP:
#
#   bash deploy/nginx/init-letsencrypt.sh dabb.degler.info
#
# Prerequisites:
#   - DNS A record for the domain points to this server's IP
#   - docker and docker compose are installed
#   - This script is run from /opt/dabb (where docker-compose.prod.yml lives)

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"
EMAIL="jan@degler.info"
CERTBOT_DIR="./deploy/nginx/certbot"

echo "==> Requesting Let's Encrypt certificate for $DOMAIN"

# Ensure certbot directories exist
mkdir -p "$CERTBOT_DIR/conf" "$CERTBOT_DIR/www"

# Write a temporary HTTP-only nginx config so certbot's ACME challenge works
# before the real certificate exists
NGINX_CONF="./deploy/nginx/nginx.conf"
TMP_CONF="./deploy/nginx/nginx-http-only.conf"
cat > "$TMP_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Waiting for SSL...';
        add_header Content-Type text/plain;
    }
}
EOF

# Start (or restart) nginx with the temporary HTTP-only config
docker compose -f docker-compose.prod.yml run --rm \
    -v "$PWD/$TMP_CONF:/etc/nginx/conf.d/default.conf:ro" \
    -p "80:80" \
    nginx nginx -g "daemon off;" &
NGINX_PID=$!
sleep 3

# Run certbot to get the initial certificate
docker compose -f docker-compose.prod.yml run --rm certbot \
    certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Stop the temporary nginx
kill "$NGINX_PID" 2>/dev/null || true
rm -f "$TMP_CONF"

# Open cert permissions for the non-root Chainguard nginx user (UID/GID 65532).
# certbot deploy hooks don't run on the initial issuance, so we fix here.
echo "==> Fixing certificate permissions for Chainguard nginx..."
CERTBOT_CONF="$CERTBOT_DIR/conf"
chmod 0755 "$CERTBOT_CONF/live" "$CERTBOT_CONF/archive"
find "$CERTBOT_CONF/live" -maxdepth 1 -mindepth 1 -type d -exec chmod 0755 {} +
find "$CERTBOT_CONF/archive" -maxdepth 1 -mindepth 1 -type d -exec chmod 0755 {} +
find "$CERTBOT_CONF/archive" -name '*.pem' -exec chmod 0644 {} +
find "$CERTBOT_CONF/archive" -name 'privkey*.pem' -exec chmod 0640 {} +
chown -R root:65532 "$CERTBOT_CONF/archive"

echo "==> Certificate obtained. Starting nginx with full HTTPS config..."
docker compose -f docker-compose.prod.yml up -d nginx certbot

echo "==> Done. Verify at: https://$DOMAIN/health"
