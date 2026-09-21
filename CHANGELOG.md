# Changelog

## Unreleased

- 2026-09-21 b50ba0c Preserve markdown tables in lexical editor
- 2026-09-21 fa488d9 Upgrade lexical to 0.48
- 2026-09-21 f44247b Add curated and raw changelog views
- 2026-09-18 c5af0d9 Give ESM main/preload bundles a real require (yaml 2.9 requires 'process')
- 2026-09-18 c0c115d Changelog comment-stripping regex matches across newlines (CodeQL)
- 2026-09-18 3f8c889 Lint runs lockfile-pinned prettier/tsc from node_modules; bun out of CI
- 2026-09-18 3b4f26b Drop unused knex; run CI with yarn so test:node actually executes
- 2026-09-18 8dc688d Changelog entries for Electron 44 and sharp 0.35
- 2026-09-18 b344373 Re-resolve yaml and @babel/runtime to patched versions

- 2026-09-18 908fa1f Updated image processing (sharp 0.35) used when pasting or uploading images.
- 2026-09-18 e57dbac Updated to Electron 44 with current Chromium and Node security fixes.
- 2026-09-18 5c42e5d Added an in-app changelog view to Preferences and the welcome screen.
- 2026-09-18 e8bf0d2 Added Archivo as a bundled font option in Preferences.
- 2026-09-16 6020222 Made journal names unique regardless of capitalization.
- 2026-09-16 052c3b2 Kept loading notifications attached to fast SQLite operations.
- 2026-09-15 f3dd738 Prevented imports from escaping their selected directory through matching path prefixes.
- 2026-09-14 77ad1b2 Added a maintenance action for resetting notes.
- 2026-09-14 9ddc475 Added verified SQLite database backups.
- 2026-09-14 54c9d4d Added Markdown-tree export with referenced attachments.
- 2026-09-14 42334e3 Added import for Chronicles Markdown trees.
- 2026-09-14 d884b52 Made SQLite the source of truth for note content and journals.
- 2026-07-14 acfe4ba Restored Control-E end-of-line behavior on macOS.
- 2026-07-13 372c9bf Removed the old Markdown file after moving a note to another journal.
- 2026-04-05 5804ba6 Updated the date picker and aligned it with application themes.
- 2026-04-04 49b0e24 Restored note deletion to every document menu.
- 2026-04-04 6edfe52 Added GFM checklists to the Lexical editor.
- 2026-03-25 f595663 Preserved decoded HTML entities through Lexical Markdown imports.
- 2026-03-25 2c86d5b Tightened spacing in the Lexical editor.
- 2026-03-25 53d07f2 Prevented scrollbar bounce and improved note-link filtering.
- 2026-03-25 eba40b7 Polished theming, Lexical styling, and code-block language selection.
- 2026-03-24 356bb20 Detected duplicate document IDs across journals.
- 2026-03-22 72f8f20 Moved the local MCP server into the Electron app.
- 2026-03-21 ce3bcb4 Made Lexical the default editor and modernized the Electron backend.
- 2026-03-20 09d9967 Preserved Lexical image Markdown and rendered relative image paths.
- 2026-03-14 f5590df Improved note-link suggestion truncation and default recency ordering.
- 2026-03-12 869b254 Added the Ariake Dark theme and theme-management improvements.
- 2026-03-10 a114068 Followed system dark mode reliably and removed duplicate theme choices.
- 2026-03-10 06c1b7c Added Warm Paper and Neofloss bundled themes.
- 2026-03-09 132ebba Cached custom fonts for faster, more reliable loading.
- 2026-03-07 afdc797 Added a one-click reset for appearance settings.
- 2026-03-07 e756f5c Refined search results, note-link search, and preferences.
- 2026-03-06 61f9215 Added selectable light and dark code syntax themes.
- 2026-03-06 58e1f94 Added installable custom themes and corrected theme token behavior.
- 2026-03-04 d9193fe Applied configured font sizes to lists and code blocks.
- 2026-03-03 e10f8df Added theme storage and preference controls.

## 0.12.1 — 2026-03-02

- 2026-03-02 2519f40 Added a toggle to search suggestions and stopped them opening unexpectedly.
- 2026-03-02 9926ad2 Made editor and interface font sizes configurable.
- 2026-03-02 5195425 Completed date-query search and made matching text more compact.
- 2026-03-02 e3de053 Increased content density while preserving useful element spacing.
