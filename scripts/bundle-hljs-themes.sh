#!/bin/sh
# Copies minified highlight.js theme CSS files into a target directory.
# Used by build.sh (target: dist/hljs-themes/) and can be run manually
# for dev inspection.
#
# Usage: scripts/bundle-hljs-themes.sh [target_dir]
#   Default target: dist/hljs-themes

set -e

TARGET="${1:-dist/hljs-themes}"
SRC="node_modules/highlight.js/styles"

if [ ! -d "$SRC" ]; then
  echo "Error: highlight.js styles not found at $SRC" >&2
  echo "Run 'yarn' first to install dependencies." >&2
  exit 1
fi

mkdir -p "$TARGET"
mkdir -p "$TARGET/base16"

# Copy only minified files
cp "$SRC"/*.min.css "$TARGET/"
cp "$SRC"/base16/*.min.css "$TARGET/base16/"

COUNT=$(find "$TARGET" -name '*.min.css' | wc -l | tr -d ' ')
SIZE=$(du -sh "$TARGET" | cut -f1)

echo "Bundled $COUNT highlight.js themes ($SIZE) into $TARGET"
