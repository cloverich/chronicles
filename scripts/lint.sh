#!/usr/bin/env bash
# Lint script — single source of truth for pinned tool versions.
# Used by package.json scripts and CI so they always run identically.
#
# Usage:
#   scripts/lint.sh          # check only (used by CI and lint:check)
#   scripts/lint.sh --fix    # auto-fix formatting (used by lint)

set -euo pipefail

PRETTIER_MODE="--check"
if [[ "${1:-}" == "--fix" ]]; then
  PRETTIER_MODE="--write"
fi

bunx prettier@3.2.4 . $PRETTIER_MODE
bunx tsc@5.3.3 --noEmit --skipLibCheck
