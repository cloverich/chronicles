#!/bin/bash

# https://github.com/electron/electron-rebuild/issues/591
# https://github.com/cloverich/chronicles/issues/66

# Electron's version.
# example of electron -v --> v15.1.1
export npm_config_target=$(npx electron -v)

# The architecture of Electron, see https://electronjs.org/docs/tutorial/support#supported-platforms
# for supported architectures.
export npm_config_arch=x64
export npm_config_target_arch=x64

# Download headers for Electron.
export npm_config_disturl=https://electronjs.org/headers

# Tell node-pre-gyp that we are building for Electron.
export npm_config_runtime=electron

# Tell node-pre-gyp to build module from source code.
export npm_config_build_from_source=true

echo Rebuilding better-sqlite3 using electron version $npm_config_target
HOME=~/.electron-gyp npm rebuild better-sqlite3