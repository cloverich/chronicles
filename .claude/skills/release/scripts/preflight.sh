#!/bin/bash
set -e

# release/scripts/preflight.sh
# Validates git state and outputs release info for the agent to read.

# Clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

# On master
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  echo "Error: Must be on master branch (currently on '$BRANCH')." >&2
  exit 1
fi

# Up-to-date with origin
git fetch origin --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Error: Not up-to-date with origin/master. Run git pull first." >&2
  exit 1
fi

# Last tag and suggested next version
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo "Last release: $LAST_TAG"

if [ "$LAST_TAG" != "none" ]; then
  VERSION="${LAST_TAG#v}"
  MAJOR=$(echo "$VERSION" | cut -d. -f1)
  MINOR=$(echo "$VERSION" | cut -d. -f2)
  NEXT_MINOR=$((MINOR + 1))
  echo "Suggested next version: v${MAJOR}.${NEXT_MINOR}.0  (or v${MAJOR}.${MINOR}.x for a hotfix)"
  echo ""
  echo "Commits since $LAST_TAG:"
  git log "${LAST_TAG}..HEAD" --oneline --no-merges
else
  echo "No previous tags found. Please specify version manually."
fi
