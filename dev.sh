#!/bin/bash
# Dabb Local Development Script
# Works with Docker and Podman (with docker compatibility/aliases)
#
# Usage: ./dev.sh [command]
#
# Commands:
#   start       Start all services (default)
#   stop        Stop all services
#   restart     Restart all services
#   logs        Show logs (follow mode)
#   status      Show service status
#   health      Check health of all services
#   shell       Open shell in a container (usage: ./dev.sh shell <service>)
#   db          Connect to PostgreSQL
#   reset       Stop services and remove volumes (fresh start)
#   build       Rebuild all images
#   mobile      Start Expo mobile dev server
#   apk         Build Android APK in Docker
#   help        Show this help message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect container runtime (Docker or Podman)
detect_runtime() {
    if command -v docker &> /dev/null; then
        # Check if docker is actually podman (alias)
        if docker --version 2>&1 | grep -qi podman; then
            echo "podman"
        else
            echo "docker"
        fi
    elif command -v podman &> /dev/null; then
        echo "podman"
    else
        echo ""
    fi
}

RUNTIME=$(detect_runtime)

if [[ -z "$RUNTIME" ]]; then
    echo -e "${RED}Error: Neither Docker nor Podman found.${NC}"
    echo "Please install Docker or Podman to run this script."
    echo ""
    echo "Install Docker: https://docs.docker.com/get-docker/"
    echo "Install Podman: https://podman.io/getting-started/installation"
    exit 1
fi

# Determine compose command
if [[ "$RUNTIME" == "podman" ]]; then
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
    elif command -v docker-compose &> /dev/null; then
        # docker-compose might work with podman socket
        COMPOSE_CMD="docker-compose"
    elif podman compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="podman compose"
    else
        echo -e "${RED}Error: No compose command found for Podman.${NC}"
        echo "Please install podman-compose or enable podman compose plugin."
        echo ""
        echo "Install: pip install podman-compose"
        echo "   or:   dnf install podman-compose"
        echo "   or:   apt install podman-compose"
        exit 1
    fi
else
    # Docker
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Error: Docker Compose not found.${NC}"
        echo "Please install Docker Compose."
        exit 1
    fi
fi

# Print header
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║        ${GREEN}Dabb Local Development${BLUE}          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo -e "Runtime: ${GREEN}$RUNTIME${NC} | Compose: ${GREEN}$COMPOSE_CMD${NC}"
    echo ""
}

# Start services
cmd_start() {
    print_header
    echo -e "${YELLOW}Clearing old logs and starting services...${NC}"
    echo ""

    # Force recreate containers to clear old logs
    $COMPOSE_CMD up -d --build --force-recreate

    echo ""
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

    local failed=false

    # Wait for postgres
    echo -n "  PostgreSQL: "
    for i in {1..30}; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U dabb -d dabb &> /dev/null; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        if [[ $i -eq 30 ]]; then
            echo -e "${RED}timeout${NC}"
            failed=true
        fi
        sleep 1
    done

    # Wait for server
    echo -n "  Server:     "
    for i in {1..60}; do
        if curl -sf http://localhost:3000/health &> /dev/null; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        if [[ $i -eq 60 ]]; then
            echo -e "${RED}timeout${NC}"
            failed=true
        fi
        sleep 1
    done

    # Wait for web
    echo -n "  Web:        "
    for i in {1..30}; do
        if curl -sf http://localhost:8080/ &> /dev/null; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        if [[ $i -eq 30 ]]; then
            echo -e "${RED}timeout${NC}"
            failed=true
        fi
        sleep 1
    done

    echo ""
    if [[ "$failed" == "true" ]]; then
        echo -e "${RED}Some services failed to start. Check logs with: ./dev.sh logs${NC}"
    else
        echo -e "${GREEN}Services started successfully!${NC}"
    fi
    echo ""
    echo "Access the application:"
    echo -e "  Web app:    ${BLUE}http://localhost:8080${NC}"
    echo -e "  Server API: ${BLUE}http://localhost:3000${NC}"
    echo -e "  PostgreSQL: ${BLUE}postgresql://dabb:dabb_dev_password@localhost:5432/dabb${NC}"
    echo ""
    echo "Useful commands:"
    echo "  ./dev.sh mobile   - Start Expo mobile dev server"
    echo "  ./dev.sh logs     - View logs"
    echo "  ./dev.sh status   - Check status"
    echo "  ./dev.sh stop     - Stop services"
}

# Stop services
cmd_stop() {
    print_header
    echo -e "${YELLOW}Stopping services...${NC}"
    $COMPOSE_CMD down
    echo -e "${GREEN}Services stopped.${NC}"
}

# Restart services
cmd_restart() {
    cmd_stop
    echo ""
    cmd_start
}

# Show logs
cmd_logs() {
    print_header
    echo -e "${YELLOW}Showing logs (Ctrl+C to exit)...${NC}"
    echo ""
    $COMPOSE_CMD logs -f "${@:2}"
}

# Show status
cmd_status() {
    print_header
    echo -e "${YELLOW}Service Status:${NC}"
    echo ""
    $COMPOSE_CMD ps
}

# Health check
cmd_health() {
    print_header
    echo -e "${YELLOW}Health Check:${NC}"
    echo ""

    # PostgreSQL
    echo -n "  PostgreSQL: "
    if $COMPOSE_CMD exec -T postgres pg_isready -U dabb -d dabb &> /dev/null; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${RED}unhealthy${NC}"
    fi

    # Server
    echo -n "  Server:     "
    if curl -sf http://localhost:3000/health &> /dev/null; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${RED}unhealthy${NC}"
    fi

    # Web
    echo -n "  Web:        "
    if curl -sf http://localhost:8080/ &> /dev/null; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${RED}unhealthy${NC}"
    fi

    echo ""
}

# Open shell in container
cmd_shell() {
    local service="${2:-server}"
    print_header

    case "$service" in
        postgres|db)
            echo -e "${YELLOW}Opening shell in PostgreSQL container...${NC}"
            $COMPOSE_CMD exec postgres sh
            ;;
        server)
            echo -e "${YELLOW}Opening shell in Server container...${NC}"
            $COMPOSE_CMD exec server sh
            ;;
        web)
            echo -e "${YELLOW}Opening shell in Web container...${NC}"
            $COMPOSE_CMD exec web sh
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            echo "Available services: postgres, server, web"
            exit 1
            ;;
    esac
}

# Connect to database
cmd_db() {
    print_header
    echo -e "${YELLOW}Connecting to PostgreSQL...${NC}"
    echo "(Type \\q to exit)"
    echo ""
    $COMPOSE_CMD exec postgres psql -U dabb -d dabb
}

# Reset (stop and remove volumes)
cmd_reset() {
    print_header
    echo -e "${RED}WARNING: This will remove all data including the database!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping services and removing volumes...${NC}"
        $COMPOSE_CMD down -v
        echo -e "${GREEN}Reset complete. Run './dev.sh start' to start fresh.${NC}"
    else
        echo "Cancelled."
    fi
}

# Build images
cmd_build() {
    print_header
    echo -e "${YELLOW}Building images...${NC}"
    $COMPOSE_CMD build "${@:2}"
    echo -e "${GREEN}Build complete.${NC}"
}

# Start Expo mobile dev server
cmd_mobile() {
    print_header

    # Check that the server is running
    echo -n "Checking server health... "
    if ! curl -sf http://localhost:3000/health &> /dev/null; then
        echo -e "${RED}not running${NC}"
        echo ""
        echo -e "${RED}Server is not running. Start it first with: ./dev.sh start${NC}"
        exit 1
    fi
    echo -e "${GREEN}ok${NC}"

    # Auto-detect LAN IP for physical device connectivity
    local lan_ip=""
    lan_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}') \
        || lan_ip=$(hostname -I 2>/dev/null | awk '{print $1}') \
        || lan_ip=""

    if [[ -z "$lan_ip" ]]; then
        echo -e "${YELLOW}Warning: Could not detect LAN IP. Physical devices may not be able to connect.${NC}"
        lan_ip="localhost"
    fi

    local server_url="http://${lan_ip}:3000"

    echo ""
    echo -e "LAN IP:     ${BLUE}${lan_ip}${NC}"
    echo -e "Server URL: ${BLUE}${server_url}${NC}"
    echo ""
    echo -e "${YELLOW}Starting Expo dev server...${NC}"
    echo ""

    cd apps/mobile
    EXPO_PUBLIC_SERVER_URL="$server_url" npx expo start --go
}

# Build Android APK in Docker
cmd_apk() {
    print_header
    echo -e "${YELLOW}Building Android APK in Docker...${NC}"
    echo ""

    echo -e "Building Docker image (this may take a while on first run)..."
    $RUNTIME build -f apps/mobile/Dockerfile.android -t dabb-android-builder .

    echo ""
    echo -e "${YELLOW}Running APK build...${NC}"
    echo ""

    $RUNTIME run --rm \
        -v "$(pwd):/app" \
        -v dabb-gradle-cache:/gradle-cache \
        -e GRADLE_USER_HOME=/gradle-cache \
        dabb-android-builder

    echo ""
    echo -e "${GREEN}APK built successfully: apps/mobile/build/dabb.apk${NC}"
}

# Show help
cmd_help() {
    print_header
    cat << 'EOF'
Commands:
  start       Start all services (default)
  stop        Stop all services
  restart     Restart all services
  logs        Show logs (follow mode)
              Optional: ./dev.sh logs <service>
  status      Show service status
  health      Check health of all services
  shell       Open shell in a container
              Usage: ./dev.sh shell <service>
              Services: postgres, server, web
  db          Connect to PostgreSQL CLI
  reset       Stop services and remove volumes (fresh start)
  build       Rebuild all images
              Optional: ./dev.sh build --no-cache
  mobile      Start Expo mobile dev server
              Requires: ./dev.sh start (server must be running)
  apk         Build Android APK in Docker container
              Output: apps/mobile/build/dabb.apk
  help        Show this help message

Examples:
  ./dev.sh start              # Start all services
  ./dev.sh logs server        # Follow server logs only
  ./dev.sh shell server       # Open shell in server container
  ./dev.sh db                 # Connect to PostgreSQL
  ./dev.sh reset              # Fresh start with empty database
  ./dev.sh mobile             # Start Expo mobile dev server
  ./dev.sh apk               # Build Android APK in Docker

Environment:
  The following defaults are used for local development:
  - Database: dabb / dabb_dev_password
  - Web:      http://localhost:8080
  - Server:   http://localhost:3000
  - DB Port:  5432

EOF
}

# Main command dispatcher
COMMAND="${1:-start}"

case "$COMMAND" in
    start)   cmd_start "$@" ;;
    stop)    cmd_stop "$@" ;;
    restart) cmd_restart "$@" ;;
    logs)    cmd_logs "$@" ;;
    status)  cmd_status "$@" ;;
    health)  cmd_health "$@" ;;
    shell)   cmd_shell "$@" ;;
    db)      cmd_db "$@" ;;
    reset)   cmd_reset "$@" ;;
    build)   cmd_build "$@" ;;
    mobile)  cmd_mobile "$@" ;;
    apk)     cmd_apk "$@" ;;
    help|-h|--help) cmd_help ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo "Run './dev.sh help' for usage."
        exit 1
        ;;
esac
