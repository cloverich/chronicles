#!/usr/bin/env bash
# Lint script — used by package.json scripts and CI so they always run identically.
# Tool versions come from package.json/yarn.lock (prettier and typescript are
# exact pins), so this never fetches anything from the registry.
#
# Usage:
#   scripts/lint.sh          # check only (used by CI and lint:check)
#   scripts/lint.sh --fix    # auto-fix formatting (used by lint)

set -euo pipefail

PRETTIER_MODE="--check"
if [[ "${1:-}" == "--fix" ]]; then
  PRETTIER_MODE="--write"
fi

node_modules/.bin/prettier . $PRETTIER_MODE
node_modules/.bin/tsc --noEmit --skipLibCheck
