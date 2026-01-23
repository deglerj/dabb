#!/bin/bash
# Dabb deployment script
# Usage: ./deploy.sh [environment]
#   environment: dev (default), prod
#
# This script can be used for manual deployments or as a reference for CI/CD

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-dev}"

cd "$PROJECT_ROOT"

echo "=== Dabb Deployment ==="
echo "Environment: $ENVIRONMENT"
echo ""

case "$ENVIRONMENT" in
    dev)
        echo "[1/3] Building development images..."
        docker compose build

        echo "[2/3] Starting services..."
        docker compose up -d

        echo "[3/3] Waiting for services to be healthy..."
        sleep 5
        docker compose ps

        echo ""
        echo "=== Development deployment complete ==="
        echo "Web app: http://localhost:8080"
        echo "Server:  http://localhost:3000"
        echo "DB:      postgresql://dabb:dabb_dev_password@localhost:5432/dabb"
        ;;

    prod)
        # Ensure required environment variables are set
        : "${CLIENT_URL:?CLIENT_URL environment variable is required}"
        : "${VITE_SERVER_URL:?VITE_SERVER_URL environment variable is required}"
        : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD environment variable is required}"

        echo "[1/4] Pulling latest images..."
        docker compose -f docker-compose.prod.yml pull || true

        echo "[2/4] Building images..."
        docker compose -f docker-compose.prod.yml build

        echo "[3/4] Starting services..."
        docker compose -f docker-compose.prod.yml up -d

        echo "[4/4] Waiting for services to be healthy..."
        sleep 10
        docker compose -f docker-compose.prod.yml ps

        echo ""
        echo "=== Production deployment complete ==="
        ;;

    *)
        echo "Unknown environment: $ENVIRONMENT"
        echo "Usage: ./deploy.sh [dev|prod]"
        exit 1
        ;;
esac
