# Backups

Chronicles implements the shared backup format in `code/docs/backup-format.md`
(RFC: Engram note `03gx06dl2o6wrvohwa5z06kr9`, "Unified backup design"). This
page records the Chronicles-specific decisions; the format, retention policy,
and manifest are defined there.

## Where it lives

- `src/backup/` — the whole feature behind one interface (`createBackups`):
  `status`, `pickDestination`, `run`, `list`, `restore`, plus
  `scheduleRestore` / `applyPendingRestore` for the startup swap. It runs in
  the **main process**.
- The app supplies only `src/node-client/backup-queries.ts` (fingerprint and
  counts) and the attachments directory (`<notesDir>/_attachments`).
- `src/electron/backups.ts` wires the picker, IPC, startup restore, and the
  activity timer. `src/preload/backups.ts` is the renderer bridge;
  `src/views/backups/` is the page (Preferences → Backups → Open backups).

## Decisions

- **Separate connections.** The preload owns the app's database connection.
  Backups open their own short-lived read-only connection for the fingerprint
  and `VACUUM INTO`; WAL makes that safe alongside the app's writes.
- **Restore happens at startup.** The renderer asks to restore a snapshot; the
  main process verifies it, records it as pending in the backup state file,
  and relaunches. On the next launch `initAppEnvironment` runs the restore
  before migrations or the window open the database. The module refuses if a
  connection is still open: it opens read-write, checkpoints, closes, and treats
  surviving `-wal`/`-shm` sidecars as another holder. A pending restore is
  cleared before it runs, so a crash cannot loop; the result or error shows on
  the Backups page.
- **Destination is main-process state.** It is stored as an opaque handle
  (`path:<abs>` today) in `<userData>/backups.json`, not in `settings.json`,
  because the renderer's preferences API can write `settings.json`. Only the
  native picker sets it. No backup IPC channel accepts a path; restore takes a
  snapshot name, which must match a listed snapshot.
- **Fingerprint** is `max(updatedAt)` and row counts over documents and
  journals, plus the tag count. Activity runs compare it with the newest
  manifest, whose fingerprint is computed from the snapshot itself.
- **Sync-folder guard.** `notesDir` cannot be changed to a path under
  `~/Library/Mobile Documents` or `~/Library/CloudStorage/*` (symlinks
  resolved). Existing settings keep working; the Backups page warns instead.
  iCloud "Desktop & Documents" syncing is not detected.
- **Conformance.** `src/backup/backup-manifest.schema.json` is a vendored copy
  of the shared schema. The test validates emitted manifests against it and,
  when `code/docs` is checked out beside the repo, fails if the copy drifts.
