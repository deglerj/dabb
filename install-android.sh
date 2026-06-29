#!/bin/bash
# Build Android dev APK via Docker and install on connected device via ADB.
# No local Android SDK or JDK required.
# Usage: ./install-android.sh [--skip-build]
set -euo pipefail

SKIP_BUILD=false
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=true
fi

APK="apps/client/build/dabb.apk"

if [[ "$SKIP_BUILD" == false ]]; then
  echo "==> Building APK via Docker..."
  bash apps/client/scripts/build-apk.sh
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
