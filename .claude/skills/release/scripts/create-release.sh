#!/bin/bash
set -e

# release/scripts/create-release.sh <version> <theme> <notes-file> [--prerelease] [--publish]
# Example: create-release.sh v0.14.0 "Search & Layout" /tmp/notes.md --prerelease
#
# Expects the changelog already cut (`yarn changelog --release <version>`),
# committed, and pushed. Builds and packages before tagging so a failed build
# leaves no stray tag. Creates a draft unless --publish is given.

VERSION=$1
THEME=$2
NOTES_FILE=$3
shift 3 || true

PRERELEASE=""
DRAFT="--draft"
for flag in "$@"; do
  case "$flag" in
    --prerelease) PRERELEASE="--prerelease" ;;
    --publish) DRAFT="" ;;
    *) echo "Unknown flag: $flag" >&2; exit 1 ;;
  esac
done

if [ -z "$VERSION" ] || [ -z "$THEME" ] || [ -z "$NOTES_FILE" ]; then
  echo "Usage: create-release.sh <version> <theme> <notes-file> [--prerelease] [--publish]" >&2
  exit 1
fi
case "$VERSION" in v*) ;; *) VERSION="v$VERSION" ;; esac

if [ ! -f "$NOTES_FILE" ]; then
  echo "Error: Notes file not found: $NOTES_FILE" >&2
  exit 1
fi

if ! grep -q "^## ${VERSION#v} — " CHANGELOG.md; then
  echo "Error: CHANGELOG.md has no '## ${VERSION#v} — <date>' heading. Run: yarn changelog --release ${VERSION#v}" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree is not clean. Commit the changelog cut first." >&2
  exit 1
fi

git fetch origin --quiet
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/master)" ]; then
  echo "Error: HEAD is not pushed to origin/master." >&2
  exit 1
fi

echo "==> Building app (output suppressed; shown on failure)..."
BUILD_LOG=$(mktemp /tmp/chronicles-build-XXXXXX.log)
if ! yarn build > "$BUILD_LOG" 2>&1; then
  echo "Build failed. Last 20 lines:"
  tail -n 20 "$BUILD_LOG"
  rm "$BUILD_LOG"
  exit 1
fi
rm "$BUILD_LOG"
echo "    Build complete."

echo "==> Locating .app bundle..."
LATEST_APP=$(find packaged -name "*.app" -type d -maxdepth 3 | sort -V | tail -1)
if [ -z "$LATEST_APP" ]; then
  echo "Error: No .app bundle found in packaged/ after build." >&2
  exit 1
fi
echo "    Found: $LATEST_APP"

echo "==> Verifying code signature..."
codesign --verify --deep --strict "$LATEST_APP"
echo "    Signature valid."

echo "==> Creating DMG..."
DMG_PATH="packaged/Chronicles-${VERSION}.dmg"
STAGE=$(mktemp -d /tmp/chronicles-dmg-XXXXXX)
cp -Rc "$LATEST_APP" "$STAGE/" 2>/dev/null || ditto "$LATEST_APP" "$STAGE/$(basename "$LATEST_APP")"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG_PATH"
diskutil image create from --format UDZO --volumeName "Chronicles ${VERSION}" \
  "$STAGE" "$DMG_PATH" > /dev/null 2>&1
rm -rf "$STAGE"
echo "    DMG: $DMG_PATH"

echo "==> Tagging $VERSION"
git tag "$VERSION"
git push origin "$VERSION"

echo "==> Creating GitHub release..."
gh release create "$VERSION" \
  $DRAFT $PRERELEASE \
  --verify-tag \
  --title "${VERSION} - ${THEME}" \
  --notes-file "$NOTES_FILE" \
  "$DMG_PATH"

echo ""
echo "Done: $(gh release view "$VERSION" --json url -q .url)"
