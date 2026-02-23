#!/bin/bash
set -e

# local-install/scripts/install-build.sh
# Automates building and installing the Chronicles application locally on macOS.

echo "Starting build process..."
# Redirect verbose build logs to a temporary file to keep the agent context clean.
# Using a more robust temp file creation
BUILD_LOG=$(mktemp -t chronicles-build.XXXXXX)
mv "$BUILD_LOG" "${BUILD_LOG}.log"
BUILD_LOG="${BUILD_LOG}.log"

if ! yarn build > "$BUILD_LOG" 2>&1; then
  echo "Error: Build failed. Last 20 lines of logs:"
  tail -n 20 "$BUILD_LOG"
  echo "Full logs available at: $BUILD_LOG"
  exit 1
fi

echo "Locating the latest build..."
# find the latest .app bundle in the packaged directory
LATEST_APP=$(find packaged -name "*.app" -type d -maxdepth 3 | sort -V | tail -1)

if [ -z "$LATEST_APP" ]; then
  echo "Error: No .app bundle found in 'packaged/' directory after build."
  exit 1
fi

APP_NAME=$(basename "$LATEST_APP")
TARGET="/Applications/$APP_NAME"

echo "Found latest build: $LATEST_APP"
echo "Installing to $TARGET..."

# On macOS, replacing an app bundle is best done by removing the old one first
if [ -d "$TARGET" ]; then
  echo "Removing existing installation..."
  rm -rf "$TARGET"
fi

# Copy the new bundle
cp -R "$LATEST_APP" "/Applications/"

echo "Successfully installed $APP_NAME to /Applications."
echo "You can launch it from your Applications folder or via Spotlight."
rm "$BUILD_LOG"
