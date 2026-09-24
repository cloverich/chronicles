# Changelog style

The committed `CHANGELOG.md` is the curated, default in-app changelog. The
build also bundles the 50 newest Git commits as an independent raw view.
Neither view fetches changelog content at runtime.

Use one user-facing sentence per entry:

```md
## Unreleased

- 2026-09-18 a1b2c3d Describe one visible change.
```

Keep entries newest first. The top curated SHA is the catch-up boundary.
Grouping related commits means keeping the newest representative line and
deleting older lines in that group; do not add cursor or coverage comments.
Release headings use `## VERSION — YYYY-MM-DD`.

Run `yarn changelog` to insert candidates since the top curated SHA,
`node scripts/changelog.mjs --raw` to preview them, and
`yarn changelog:check` to validate the file. The build bundles raw history
independently, including chores and curation commits.

## Releasing

`yarn changelog --release X.Y.Z` moves the `## Unreleased` entries under
`## X.Y.Z — <today>`. Commit that cut before tagging: `yarn changelog:check`
(run by the pre-commit hook and `yarn build`) fails when HEAD carries a release
tag without a matching heading. GitHub release notes are written from the cut
section; the `release` skill covers the rest.

Install the tracked pre-commit check with
`install -m 755 .githooks/pre-commit "$(git rev-parse --git-path hooks/pre-commit)"`.
