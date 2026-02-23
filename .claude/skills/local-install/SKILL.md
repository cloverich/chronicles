---
name: local-install
description: Automates the build and local installation of the Chronicles application on macOS. Use when the user wants to test a local build of the application by installing it into their /Applications folder.
---

# Local Build & Install

This skill provides a streamlined workflow to build and install the Chronicles application directly to your macOS /Applications directory.

## Workflow

1.  **Build**: It executes yarn build, which compiles the renderer, preloads, and main processes, and then packages them into a macOS bundle using @electron/packager.
2.  **Locate**: It automatically finds the latest build artifact in the packaged/ directory, identifying the newest .app bundle (e.g., Chronicles.app).
3.  **Install**: It replaces any existing installation at /Applications/Chronicles.app with the freshly built bundle.

## Usage

When you are ready to test your changes in a real, installed environment:

- "Build and install the app locally."
- "Create a new local build and put it in /Applications."

## Scripts

The skill uses a bundled script to handle the multi-step process:
- scripts/install-build.sh: The core automation script.

### Notes
- Ensure you have the necessary permissions to write to /Applications.
- The build process can take a few minutes as it involves compiling assets and rebuilding native dependencies (like sqlite3).
- You may want to close any running instances of the application before installation to ensure the replacement is successful.
- Intermediate logs from the build are hidden unless it fails, in which case the last 20 lines will be shown.
