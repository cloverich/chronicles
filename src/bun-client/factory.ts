import { Database } from "bun:sqlite";
import Conf from "conf";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { BulkOperationsClient } from "./bulk-operations";
import { DocumentsClient } from "./documents";
import { BunFilesClient } from "./files";
import { ImporterClient } from "./importer";
import { IndexerClient } from "./indexer";
import { JournalsClient } from "./journals";
import type { IPreferences } from "./preferences";
import { PREFERENCES_DEFAULTS, PreferencesClient } from "./preferences";
import * as schema from "./schema";
import { TagsClient } from "./tags";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When bundled for Electrobun, __dirname points inside the app bundle where
// migration SQL files don't exist. The build script injects the real project
// root so we can resolve to the source tree's migration folder.
const projectRoot: string | undefined =
  process.env.CHRONICLES_PROJECT_ROOT || undefined;

export interface CreateClientOptions {
  dbPath: string; // ":memory:" for tests, or absolute file path
  notesDir: string;
  /** Directory for the settings file. Defaults to notesDir. */
  settingsDir?: string;
}

export interface BunClient {
  db: BunSQLiteDatabase<typeof schema>;
  /** The raw bun:sqlite Database, exposed for manual SQL when needed */
  sqlite: Database;
  notesDir: string;
  preferences: PreferencesClient;
  journals: JournalsClient;
  documents: DocumentsClient;
  indexer: IndexerClient;
  bulkOperations: BulkOperationsClient;
  tags: TagsClient;
  importer: ImporterClient;
}

/**
 * Creates a bun-client instance: opens (or creates) a SQLite database,
 * runs Drizzle migrations, creates the FTS5 virtual table, and returns
 * a typed Drizzle db handle.
 */
export async function createClient(
  opts: CreateClientOptions,
): Promise<BunClient> {
  const sqlite = new Database(opts.dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.exec("PRAGMA journal_mode = WAL;");
  // Enable foreign keys
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const db = drizzle(sqlite, { schema });

  // Apply Drizzle-managed migrations
  // In bundled context (Electrobun), __dirname is inside the app bundle.
  // Use project root if available to find the source-tree migrations.
  const migrationsFolder = projectRoot
    ? path.resolve(projectRoot, "src/bun-client/migrations")
    : path.resolve(__dirname, "migrations");

  // Drizzle expects this bookkeeping table. Ensure it exists before we query
  // it for compatibility with fresh file-backed databases.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      "hash" TEXT NOT NULL,
      "created_at" NUMERIC
    );
  `);

  // Handle migration for databases that already have the schema (e.g. created
  // by Electron's migration system or by a previous Drizzle run that didn't
  // record entries). If tables exist but the Drizzle journal is empty, stamp
  // the migration as applied so Drizzle doesn't try to re-create tables.
  const hasExistingTables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='documents'",
    )
    .get();
  const migrationCount = sqlite
    .prepare("SELECT count(*) as c FROM __drizzle_migrations")
    .get() as { c: number } | null;

  if (hasExistingTables && (!migrationCount || migrationCount.c === 0)) {
    // Schema exists but Drizzle doesn't know about it — stamp the initial
    // migration as applied so it doesn't try to re-create everything.
    console.log(
      "[bun-client] Existing schema detected, stamping Drizzle migration journal",
    );
    sqlite.exec(
      `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0000_demonic_avengers', ${Date.now()})`,
    );
  }

  migrate(db, { migrationsFolder });

  // FTS5 virtual table — not expressible in Drizzle schema, so we create it
  // manually (idempotent).
  const ftsExists = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'",
    )
    .get();

  if (!ftsExists) {
    sqlite.exec(`
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        id,
        title,
        content,
        tokenize='porter unicode61'
      );
    `);
  }

  const conf = new Conf<IPreferences>({
    cwd: opts.settingsDir ?? opts.notesDir,
    configName: "settings",
    defaults: PREFERENCES_DEFAULTS,
  });
  const preferences = new PreferencesClient(conf);
  const files = new BunFilesClient(opts.notesDir);
  const journals = new JournalsClient(db, files, preferences);
  const documents = new DocumentsClient(db, files, opts.notesDir);
  const indexer = new IndexerClient(
    db,
    journals,
    documents,
    files,
    preferences,
  );
  const bulkOperations = new BulkOperationsClient(db, documents);
  const tags = new TagsClient(db);
  const importer = new ImporterClient(
    db,
    documents,
    files,
    preferences,
    indexer,
    opts.notesDir,
  );

  return {
    db,
    sqlite,
    notesDir: opts.notesDir,
    preferences,
    journals,
    documents,
    indexer,
    bulkOperations,
    tags,
    importer,
  };
}
