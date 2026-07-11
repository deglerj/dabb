#!/bin/bash
# Fix Hermes hermesc symlink for pnpm monorepo on Linux.
# pnpm puts hermes-compiler in a sibling dir of react-native in the content store;
# React Native's build expects hermesc at react-native/sdks/hermesc.
# Only needed on Linux; macOS ships hermesc differently.

if [ "$(uname)" != "Linux" ]; then exit 0; fi

RN_DIR=$(find node_modules/.pnpm -type d -name "react-native" -path "*react-native@*/node_modules/react-native" 2>/dev/null | head -1)
if [ -z "$RN_DIR" ]; then
    echo "fix-hermes: react-native not found in .pnpm store, skipping"
    exit 0
fi

HERMES_COMPILER=$(dirname "$RN_DIR")/hermes-compiler
if [ ! -d "$HERMES_COMPILER" ]; then
    echo "fix-hermes: hermes-compiler not found, skipping"
    exit 0
fi

mkdir -p "$RN_DIR/sdks"
ln -sf "../../hermes-compiler/hermesc" "$RN_DIR/sdks/hermesc"
chmod +x "$RN_DIR/sdks/hermesc/linux64-bin/hermesc"
echo "fix-hermes: symlink created at $RN_DIR/sdks/hermesc"
