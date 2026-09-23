# Design Doc: SQLite as the authoritative note store

> **Status: complete** on branch `sqlite-source-of-truth`; steps 1–8 landed. Tracked in Engram (not GitHub issues).

## Goal

SQLite becomes the sole source of truth for note content and metadata. Markdown stays the editor format and the import/export format, but is no longer the live store. Attachments stay as files on disk with metadata in the database.

This removes the two-truths reconciliation the app used to carry (a journal move wrote a file, deleted the old one, then updated SQLite; the indexer then needed mtime/hash/orphan/duplicate logic to keep the index honest). It also makes a future Swift backend small: schema + CRUD + FTS, no filesystem indexer to port.

## Cutover approach

Hard cutover, one user, no transition release:

1. The user moves the existing notes directory aside as a manual backup.
2. The new build starts with a fresh document store (the current `documents` table is a rebuildable index, so the schema migration truncates it and its derived tables rather than backfilling).
3. The user imports the old directory through the app's importer, validates, and iterates on anything that doesn't round-trip.

No dry-run/apply migration tool, no dual-write, no reversible transition build. Rollback is: reinstall the previous build, move the notes directory back.

## Decisions

- **Canonical field ownership.** `documents` columns own `id`, `title`, `journal`, `createdAt`, `updatedAt`; `documentTags` owns tags; new `content` column owns the Markdown body _without_ frontmatter. The existing `frontmatter` JSON column keeps only arbitrary user keys (nothing that has a column). Frontmatter is materialized on export, parsed on import.
- **FTS stays application-managed** (delete + insert inside the write transaction, as today). No triggers.
- **Attachments unchanged**: files under the existing data directory, `chronicles://` references, `imageLinks` metadata. No dedup or GC in this project.
- **No revision history.** Deterministic export + optional Git is the history mechanism.
- **Journals are database-only.** Keyed by name; no journal directories on disk. Renaming by ID is a later change.

## Work plan

Each item is one task. Order matters through 4; 5–8 are independent after that.

1. **Schema.** Add `documents.content`. Migration truncates `documents`, `documentTags`, `documentLinks`, `imageLinks`, `documents_fts`, `sync`. Drop `mtime`, `size`, `contentHash`.
2. **DB-first reads.** `findById` and search read `content` from the row. No `.md` file is required for a note to exist.
3. **DB-first writes.** `createDocument`, `updateDocument`, `del`, journal move, and bulk operations become a single transaction writing the document row and all derived rows (tags, links, image links, FTS). Remove `files.uploadDocument` / `deleteDocument` from the note path. Failure between document and derived writes must leave no partial state.
4. **Indexer → derive + repair.** Split the indexer, don't delete it. Keep the tree-reading half and move it toward the importer: `walk`/`checkId` discovery, `readDocRaw`/`parseDoc`, duplicate-ID detection, and journal auto-create. Extract `createIndex` into a `derive(document)` step that every write and import calls, plus a `rebuildDerived()` maintenance command that regenerates all derived tables from `documents`. Delete the reconciliation half: mtime/size/hash fast paths and sync-meta helpers, `deleteOrphanedDocuments`, `cleanupOrphanedJournals`, `needsFullReindex`, the `sync` table, on-disk syncing of `archivedJournals`/`defaultJournal`, the startup trigger, and the UI-visible "reindex" affordance (keep a "repair" under maintenance).
5. **Importer: Chronicles source.** Build a Chronicles-tree source for the importer on the reader kept in step 4 (journal directories of `<id>.md` with frontmatter): preserve IDs, `createdAt`/`updatedAt`, journal from directory, tags, note links, and attachments. Re-import of an existing ID is explicit (skip or replace), never inferred from file position. Importer terminates in the same write/derive transaction as step 3. Produce a report: created, skipped, replaced, errored, duplicate IDs across journals, attachments copied. Notion and generic Markdown import keep working.
6. **Export.** `export(destDir)` writes every note as `<journal>/<id>.md` with full frontmatter and relative attachment links, via a temp dir published atomically, plus a manifest (export version, timestamp, note IDs, hashes). Byte-stable for unchanged data. Never merges into an existing directory.
7. **Backup.** `backup(destDir)` uses `VACUUM INTO` (WAL-safe) and copies the attachments directory. Surfaced in preferences alongside export. (Superseded by pooled snapshot backups; see [docs/features/backups.md](../features/backups.md).)
8. **Docs.** Update the files listed in [documentation-cleanup.md](../plans/pending/documentation-cleanup.md) that assume files-as-truth: `indexer.md`, `bulk-operations.md`, `architecture.md`, `editor/markdown-pipeline.md`, `development.md`.

## Validation

- [x] Fixture corpus of synthetic notes (frontmatter variants, tags, note links, images, code, lists, empty body, Unicode, journal move) — `src/preload/client/importer/test/chronicles-tree/`.
- CRUD, journal move, bulk ops, tags, search, backlinks, images, and restart persistence all pass with no notes directory present.
- [x] `rebuildDerived()` reproduces identical search/tag/link results (tested).
- [x] Export → import round-trip is semantically identical: IDs, journals, titles, timestamps, body, tags, links, attachments (tested).
- [x] Manual: imported the real archive (857 notes) and round-tripped export → import with 0 mismatches.

## GitHub issue cleanup

Issues are no longer tracked on GitHub; close these as part of this project:

| Issue                                                  | Action                           | Why                                                         |
| ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------- |
| #425 Startup frozen when many documents orphaned       | close, fixed by step 4           | orphans don't exist without a second truth                  |
| #409 After bulk actions, re-run sync                   | close, fixed by step 3           | derived rows update in the write transaction                |
| #401 Unable to import from sibling directories         | re-test after step 5, then close | importer is rewritten to DB-first                           |
| #397 Update PlateJS and bug bash                       | close, obsolete                  | Plate removed                                               |
| #381 Replace markdown pipeline with @platejs/markdown  | close, obsolete                  | Plate removed                                               |
| #376 Move settings setup to preload                    | close, superseded                | NotesClient / PlatformServices contract (plan step 2)       |
| #374 Isolate Electron APIs, simplify preload testing   | close, superseded                | same                                                        |
| #372 Explore node built-in SQLite                      | close, deferred                  | revisit only if better-sqlite3/Electron ABI becomes painful |
| #452 CLI theme validation script                       | close, dropped                   | no CLI in the current plan                                  |
| #357, #358, #359 Agent chat storage / UI / demarcation | close, moved                     | LLM access lives in Engram                                  |
| #442 Agent context efficiency                          | close                            | not a Chronicles issue                                      |

Everything else (theming, fonts, search UX, editor bugs) migrates to Engram when convenient.

## Non-goals

Device sync, web service, permissions, Swift backend, attachment GC, journal rename by ID, note revisions, per-journal attachment scoping / access control. This project builds the persistence foundation those would need.
