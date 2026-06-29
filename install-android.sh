#!/bin/bash
# Build Android dev APK via Docker and install on connected device via ADB.
# No local Android SDK or JDK required — only Docker and adb.
#
# Usage:
#   ./install-android.sh                  # build image if absent, build APK, install
#   ./install-android.sh --skip-build     # reinstall without rebuilding APK
#   ./install-android.sh --rebuild-image  # force Docker image rebuild
set -euo pipefail

SKIP_BUILD=false
REBUILD_IMAGE=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --rebuild-image) REBUILD_IMAGE=true ;;
  esac
done

# Always run from repo root regardless of where the script is invoked from
cd "$(dirname "${BASH_SOURCE[0]}")"

IMAGE="dabb-android-builder:local"
APK="apps/client/build/dabb.apk"
GRADLE_CACHE="$HOME/.cache/dabb-gradle"

if [[ "$SKIP_BUILD" == false ]]; then
  if ! command -v docker &>/dev/null; then
    echo "Error: docker not found. Install Docker Desktop or docker-ce." >&2
    exit 1
  fi

  if [[ "$REBUILD_IMAGE" == true ]] || ! docker image inspect "$IMAGE" &>/dev/null 2>&1; then
    echo "==> Building Docker image (one-time, ~5 min)..."
    docker build -f apps/client/Dockerfile.android -t "$IMAGE" .
  fi

  echo "==> Building APK via Docker..."
  mkdir -p "$GRADLE_CACHE"
  docker run --rm \
    -v "$(pwd):/app" \
    -v "$GRADLE_CACHE:/gradle-cache" \
    -e GRADLE_USER_HOME=/gradle-cache \
    "$IMAGE"
else
  echo "==> Skipping build (using existing $APK)"
fi

if [[ ! -f "$APK" ]]; then
  echo "Error: $APK not found. Run without --skip-build first." >&2
  exit 1
fi

if ! command -v adb &>/dev/null; then
  echo "Error: adb not found. Install Android platform-tools:" >&2
  echo "  Arch: sudo pacman -S android-tools" >&2
  echo "  Ubuntu/Debian: sudo apt install android-tools-adb" >&2
  exit 1
fi

DEVICES=$(adb devices | grep -v "^List" | grep -c "device$" || true)
if [[ "$DEVICES" -eq 0 ]]; then
  echo "Error: no Android device connected. Connect via USB and enable USB debugging." >&2
  exit 1
fi

echo "==> Installing APK on device..."
adb install -r "$APK"

echo ""
echo "==> Done. Start Metro to develop:"
echo "    pnpm --filter @dabb/client start"
