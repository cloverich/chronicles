#!/bin/bash
set -e

# release/scripts/create-release.sh <version> <theme> <notes-file>
# Example: create-release.sh v0.12.0 "Search & Layout" /tmp/chronicles-release-summary.md

VERSION=$1
THEME=$2
NOTES_FILE=$3

if [ -z "$VERSION" ] || [ -z "$THEME" ] || [ -z "$NOTES_FILE" ]; then
  echo "Usage: create-release.sh <version> <theme> <notes-file>" >&2
  exit 1
fi

if [ ! -f "$NOTES_FILE" ]; then
  echo "Error: Notes file not found: $NOTES_FILE" >&2
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

echo "==> Tagging $VERSION"
git tag "$VERSION"
git push origin "$VERSION"

echo "==> Locating .app bundle..."
LATEST_APP=$(find packaged -name "*.app" -type d -maxdepth 3 | sort -V | tail -1)
if [ -z "$LATEST_APP" ]; then
  echo "Error: No .app bundle found in packaged/ after build." >&2
  exit 1
fi
echo "    Found: $LATEST_APP"

echo "==> Creating DMG..."
DMG_PATH="packaged/Chronicles-${VERSION}.dmg"
hdiutil create \
  -volname "Chronicles ${VERSION}" \
  -srcfolder "$LATEST_APP" \
  -ov \
  -format UDZO \
  "$DMG_PATH" > /dev/null 2>&1
echo "    DMG: $DMG_PATH"

echo "==> Creating draft release on GitHub..."
gh release create "$VERSION" \
  --draft \
  --generate-notes \
  --title "${VERSION} - ${THEME}" \
  --notes "$(cat "$NOTES_FILE")" \
  "$DMG_PATH"

echo "==> Opening draft in browser..."
gh release view "$VERSION" --web

echo ""
echo "Done. Review the draft, add screenshots or narrative, then publish."
