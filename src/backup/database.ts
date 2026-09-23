import Database from "better-sqlite3";
import fs from "fs";

export type Db = Database.Database;

/** App-supplied queries, run against a read-only connection. */
export interface DatabaseQueries {
  /** Cheap, opaque summary of the live data; compared only for equality. */
  fingerprint: (db: Db) => string;
  /** Row counts recorded in the manifest; keys are free-form. */
  counts: (db: Db) => Record<string, number>;
}

export function withReadOnly<T>(file: string, fn: (db: Db) => T): T {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/**
 * Writes a consistent, standalone copy of `live` to `dest`. VACUUM INTO reads
 * one transaction, so it includes committed pages still in the WAL. The path
 * is a bound parameter, never spliced into SQL.
 */
export function vacuumInto(live: string, dest: string): void {
  withReadOnly(live, (db) => {
    db.prepare("VACUUM INTO ?").run(dest);
  });
}

/**
 * Opens a snapshot read-only and requires `PRAGMA integrity_check` = ok plus
 * the app's counts and fingerprint queries to succeed.
 */
export function verifySnapshot(
  file: string,
  queries: DatabaseQueries,
): { counts: Record<string, number>; fingerprint: string } {
  return withReadOnly(file, (db) => {
    const rows = db.prepare("PRAGMA integrity_check").pluck().all();
    if (rows.length !== 1 || rows[0] !== "ok") {
      throw new Error(
        `[BACKUP_INTEGRITY] Snapshot failed integrity check: ${rows.slice(0, 5).join("; ")}`,
      );
    }
    return { counts: queries.counts(db), fingerprint: queries.fingerprint(db) };
  });
}

/**
 * Checks that nothing else has `file` open. Opening read-write and closing
 * checkpoints the WAL; if we were the last connection SQLite deletes the
 * sidecars. Sidecars that survive mean another connection still holds it.
 */
export function assertClosed(file: string): void {
  if (!fs.existsSync(file)) return;
  const db = new Database(file, { fileMustExist: true });
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    db.close();
  }
  for (const sidecar of [`${file}-wal`, `${file}-shm`]) {
    if (fs.existsSync(sidecar)) {
      throw new Error(
        "[BACKUP_DB_OPEN] Refusing to restore while the database is open elsewhere. Quit other Chronicles windows or tools and retry.",
      );
    }
  }
}
