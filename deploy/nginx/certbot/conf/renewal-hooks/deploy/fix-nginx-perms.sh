#!/bin/sh
# Certbot deploy hook: run after each successful cert renewal.
# Opens permissions on the renewed cert files so the non-root Chainguard
# nginx user (UID/GID 65532) can read them.
set -e

chmod 0755 /etc/letsencrypt/live /etc/letsencrypt/archive
find /etc/letsencrypt/live -maxdepth 1 -mindepth 1 -type d -exec chmod 0755 {} +
find /etc/letsencrypt/archive -maxdepth 1 -mindepth 1 -type d -exec chmod 0755 {} +
find /etc/letsencrypt/archive -name '*.pem' -exec chmod 0644 {} +
find /etc/letsencrypt/archive -name 'privkey*.pem' -exec chmod 0640 {} +
chown -R root:65532 /etc/letsencrypt/archive

echo "Cert permissions fixed for Chainguard nginx (UID/GID 65532)"
