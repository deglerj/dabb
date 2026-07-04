#!/bin/bash
# Point git at the repo's own hooks dir (replaces husky).
# Skips silently outside a git checkout (e.g. Docker build contexts).

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

git config core.hooksPath .githooks
