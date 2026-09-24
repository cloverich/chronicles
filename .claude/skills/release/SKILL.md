---
name: release
description: Cuts the changelog, tags, builds a signed DMG, and creates a GitHub release with concise AI-generated notes. Use when the user wants to cut a new release.
---

# Release Workflow

`CHANGELOG.md` is the source for release notes (see `docs/changelog-style.md`). The changelog heading is cut and committed before tagging: the pre-commit hook and `yarn build` both refuse a tagged HEAD without a matching `## X.Y.Z — date` heading.

## Prerequisites

- Clean `master`, up-to-date with `origin`; `gh` authenticated
- Signing is automatic (`osxSign: true` in `package.js`). Notarization is not enabled yet (issue #442).

## Steps

### 1. Preflight

Run `scripts/preflight.sh`. It checks git state and lint, then prints the suggested version, merged PRs and non-docs commits since the last tag, the `## Unreleased` entries, and commits not yet in the changelog.

### 2. Confirm version and release type

Minor (`v0.x.0`) for feature work, patch only for a hotfix. Ask whether it is a pre-release and whether to publish or leave a draft (default: draft).

### 3. Curate and cut the changelog

- If uncurated commits are user-facing, run `yarn changelog`, rewrite the inserted lines per `docs/changelog-style.md`, and delete chores/docs.
- Run `yarn changelog --release X.Y.Z`, then commit `docs: cut X.Y.Z changelog` and push.

### 4. Write release notes

Write notes to a scratch file from the released changelog section, plus the PR/commit list for links. Keep them short:

```md
_These release notes are AI generated._

- **Theme area**: one-line summary (2–4 bullets total)

## What's Changed

**Features**
* feat: one complete feature per line (#123, abc1234)

**Fixes**
* fix: one complete fix per line (#124)

**Full Changelog**: https://github.com/cloverich/chronicles/compare/vPREV...vX.Y.Z
```

Group related PRs/commits into one line per feature or fix. Omit docs-only commits and superseded spikes. Pick a 2–4 word release theme for the title.

### 5. Create the release

```
scripts/create-release.sh <version> "<theme>" <notes-file> [--prerelease] [--publish]
```

It verifies the changelog heading and a clean, pushed HEAD, builds, verifies the signature, packages a DMG (app plus an Applications shortcut), then tags, pushes the tag, and creates the release with the DMG attached. Tagging happens last so a failed build leaves no stray tag.

### 6. Done

Give the user the release URL.
