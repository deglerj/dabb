#!/bin/bash
# Run the web client against a local Firebase RTDB emulator.
# Starts the emulator in the background, waits for it to be ready, then
# runs the Vite dev server in the foreground. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# setsid puts the emulator in its own process group — firebase-tools spawns the actual
# Java emulator as a semi-detached child, and a plain `kill $PID` on the pnpm/node wrapper
# doesn't reach it, leaving it bound to :9000 after Ctrl+C. Killing the whole group does.
# --config firebase.dev.json selects the wide-open emulator ruleset; the default
# firebase.json carries the production rules and must not be loosened for local dev.
setsid pnpm exec firebase emulators:start --only database --project demo-dabb --config firebase.dev.json &
EMULATOR_PID=$!
cleanup() {
  kill -- "-$EMULATOR_PID" 2>/dev/null
  # Fallback in case the group kill above missed the Java process anyway.
  if command -v lsof > /dev/null 2>&1; then
    lsof -ti:9000 2>/dev/null | xargs -r kill -9 2>/dev/null
  fi
}
trap cleanup EXIT

echo "Waiting for Firebase RTDB emulator on :9000..."
for i in $(seq 1 30); do
  if nc -z localhost 9000 2>/dev/null; then
    echo "Emulator ready after ${i}s"
    break
  fi
  sleep 1
done

cd apps/client
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true \
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://demo-dabb-default-rtdb.firebaseio.com \
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-dabb \
npx vite
