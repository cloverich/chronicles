---
name: release
description: Creates a tagged GitHub draft release with AI-generated summary, signed DMG artifact, and auto-generated changelog. Use when the user wants to cut a new release.
---

# Release Workflow

Produces a signed DMG, tags the repo, generates release notes, and opens a GitHub draft release for human review before publishing.

## Prerequisites

- Clean git working tree on `master`, up-to-date with `origin`
- `gh` CLI authenticated
- Signing: automatic — `osxSign: true` is already set in `package.js`
- Notarization: not yet enabled. To enable: add `osxNotarize: { tool: 'notarytool', keychainProfile: 'chronicles' }` to `package.js` and run `xcrun notarytool store-credentials "chronicles"` once. The build handles it automatically after that. See issue #442 for context.

## Steps

### 1. Preflight

Run `scripts/preflight.sh`. Read its output — it validates git state, lists commits since the last tag, and suggests the next version.

### 2. Confirm version

Show the user the suggested version and commit list. Ask for confirmation or override.

- Default: bump minor (`v0.x.0`) for any feature work
- Patch (`v0.x.y`) only if user says it's a hotfix

### 3. Generate release summary

Analyze the commits from preflight output. Produce:
- A short release theme (2–4 words, e.g. "Search & Layout")
- 2–3 concise bullet points covering notable user-facing changes

Write the summary to `/tmp/chronicles-release-summary.md`.

**Note:** This step is a good candidate for delegation to a smaller model (e.g. haiku) to preserve context. See issue #442.

### 4. Create the release

Run:
```
scripts/create-release.sh <version> "<theme>" /tmp/chronicles-release-summary.md
```

This will:
- Create and push the git tag
- Build and sign the app (`yarn build` — verbose output suppressed, shown on failure)
- Package a DMG via `hdiutil`
- Create a draft GitHub release with the AI summary prepended to the auto-generated changelog
- Attach the DMG
- Open the draft in the browser

### 5. Done

Tell the user the draft is open in their browser. They edit the narrative if needed and publish when ready.
