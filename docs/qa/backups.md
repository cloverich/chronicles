# Backups QA

**Related docs:** [Feature doc](../features/backups.md) | Format: `code/docs/backup-format.md`

---

## Covered by automated tests (no need to retest by hand)

`src/backup/*.test.ts` run against real SQLite and real folders: retention tiers (shared vectors) and the pre-restore exemption, snapshot publishing and verification, the attachment pool and bare-blob migration, GC, the run lock, the activity decision, and restore mechanics (staging, pre-restore snapshot, open-database refusal, attachment materialization), including backup → reset → restore → next-day run.

## By hand

Run after touching the restore/relaunch wiring, the activity timer, the folder picker, backup IPC, or the Backups page, and once for each new sync folder used as a destination.

- **Back up:** Preferences → Backups → Open backups → Choose destination… (pick the sync folder) → Back up now. The snapshot is listed with today's date and `ok`; in Finder, blobs under `<folder>/chronicles/attachments/` preview in Quick Look.
- **Restore:** back up → Preferences → Reset notes → Backups → Restore… on that snapshot. The app relaunches with the notes and attachments back, the source snapshot is still listed, and the pre-restore snapshot appears beside it labelled "before restore".
- **Activity:** edit notes, then relaunch more than a day after the newest snapshot (or leave the app running past it). An `activity` snapshot appears without pressing Back up now.
