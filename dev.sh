#!/bin/bash
# Run the web client against a local Firebase RTDB emulator.
# Starts the emulator in the background, waits for it to be ready, then
# runs the Expo web dev server in the foreground. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

pnpm exec firebase emulators:start --only database --project demo-dabb &
EMULATOR_PID=$!
trap 'kill "$EMULATOR_PID" 2>/dev/null' EXIT

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
npx expo start --web
