import DB from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A hacky "migration" script after bailing on Prisma and realizing
// better-sqlite3 is not compatible with knex yet :|
// https://github.com/knex/knex/issues/4511
// todo: real migrations, backup database while migrating
export default function (dbUrl: string) {
  const db = DB(dbUrl);

  try {
    // TODO: Can it be pulled in as a dependency with a loader!?
    // https://esbuild.github.io/content-types/#external-file
    // note: migration file(s) is co-located in this folder, but the entire main process is bundled and run from a different
    // location (project root), so this needs to reconstruct __this__ directory :confusing:

    // NOTE: This is a vibe hack to support running migrations within various tests. Undo
    // this at some point...
    const possiblePaths = [
      // When bundled for main process (from project root)
      path.join(__dirname, "electron/migrations/20211005142122.sql"),
      // When bundled into test file
      path.join(process.cwd(), "src/electron/migrations/20211005142122.sql"),
      // When running unbundled (development)
      path.join(__dirname, "20211005142122.sql"),
    ];

    let migration1;
    for (const migrationPath of possiblePaths) {
      if (fs.existsSync(migrationPath)) {
        migration1 = fs.readFileSync(migrationPath, "utf8");
        break;
      }
    }

    if (!migration1) {
      throw new Error(
        `Could not find migration file. Tried: ${possiblePaths.join(", ")}`,
      );
    }

    db.exec(migration1);

    // Incremental sync support: add columns for tracking file changes
    // These columns allow skipping unchanged files during sync
    runMigration2(db);

    // FTS5 full-text search support
    runMigration3(db);
  } catch (err) {
    console.error("Error running migrations!", err);
    throw err;
  }
}

/**
 * Migration 2: Add columns for incremental sync support
 * - mtime: file modification time (ms since epoch)
 * - size: file size in bytes
 * - contentHash: SHA-256 hash of file contents
 */
function runMigration2(db: DB.Database) {
  // Check if columns already exist (idempotent migration)
  const tableInfo = db.prepare("PRAGMA table_info(documents)").all() as Array<{
    name: string;
  }>;
  const existingColumns = new Set(tableInfo.map((col) => col.name));

  if (!existingColumns.has("mtime")) {
    db.exec("ALTER TABLE documents ADD COLUMN mtime INTEGER");
  }
  if (!existingColumns.has("size")) {
    db.exec("ALTER TABLE documents ADD COLUMN size INTEGER");
  }
  if (!existingColumns.has("contentHash")) {
    db.exec("ALTER TABLE documents ADD COLUMN contentHash TEXT");
  }
}

/**
 * Migration 3: Add FTS5 full-text search support
 * Creates documents_fts virtual table for fast text search.
 * Content is populated during indexing.
 */
function runMigration3(db: DB.Database) {
  const ftsExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'",
    )
    .get();

  if (!ftsExists) {
    console.log("Creating FTS5 table for full-text search...");

    // Create FTS5 virtual table
    // - tokenize='porter unicode61' enables stemming (run->running) and unicode support
    db.exec(`
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        id,
        title,
        content,
        tokenize='porter unicode61'
      );
    `);

    console.log("FTS5 table created.");
  }
}
