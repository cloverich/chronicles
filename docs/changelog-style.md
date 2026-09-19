# Changelog style

`CHANGELOG.md` is the repository and in-app record of user-visible changes. It may be updated with a feature, after several commits, or retroactively before a release.

Each visible entry has exactly three space-separated parts:

```text
YYYY-MM-DD short-sha Description.
```

- Use a day-precision date and a seven-character commit SHA.
- Write one concrete sentence in user-facing language.
- Keep tests, refactors, dependencies, and internal chores out unless users feel the result.
- Combine related commits when that is clearer. Use the representative SHA visibly and record every contributing full SHA in the hidden `commits` comment.
- Put new work in `Unreleased`. Release headings use `VERSION — YYYY-MM-DD`.
- Do not split a release into Added, Changed, or Fixed subsections.

Good:

```md
- 2026-09-14 9ddc475 Added verified SQLite database backups. <!-- commits: 9ddc475973b52f390f619f0103402c4a7b324e23 -->
```

Avoid raw commit language, implementation narration, timestamps, tables, and punctuation between the date, SHA, and description.

Run `yarn changelog` to catch up from the hidden cursor. Run `yarn changelog --since <ref>` to scan retroactively from a tag or commit; already-covered commits are skipped. Generated candidates are intentionally editable.
