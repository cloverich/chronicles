import Database from "better-sqlite3";
import Conf from "conf";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BulkOperationsClient } from "./bulk-operations";
import { DocumentsClient } from "./documents";
import { NodeFilesClient } from "./files";
import { ImporterClient } from "./importer";
import { IndexerClient } from "./indexer";
import { JournalsClient } from "./journals";
import type { IPreferences } from "./preferences";
import { PREFERENCES_DEFAULTS, PreferencesClient } from "./preferences";
import * as schema from "./schema";
import { TagsClient } from "./tags";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When bundled for Electron, __dirname points inside the app bundle where
// migration SQL files don't exist. The build script injects the real project
// root so we can resolve to the source tree's migration folder.
const projectRoot: string | undefined =
  process.env.CHRONICLES_PROJECT_ROOT || undefined;

/**
 * Resolve the Drizzle migrations folder. Works in three contexts:
 * - CHRONICLES_PROJECT_ROOT set: explicit path (production bundle)
 * - Unbundled (vitest): __dirname is src/node-client/, so ../bun-client/migrations
 * - Bundled (esbuild → src/preload.bundle.mjs): __dirname is src/, so bun-client/migrations
 */
function resolveMigrationsFolder(): string {
  if (projectRoot) {
    return path.resolve(projectRoot, "src/bun-client/migrations");
  }
  // Try the unbundled path first (vitest, running from src/node-client/)
  const fromSource = path.resolve(__dirname, "../bun-client/migrations");
  if (fs.existsSync(path.join(fromSource, "meta"))) {
    return fromSource;
  }
  // Bundled by esbuild into src/preload.bundle.mjs — __dirname is src/
  const fromBundle = path.resolve(__dirname, "bun-client/migrations");
  if (fs.existsSync(path.join(fromBundle, "meta"))) {
    return fromBundle;
  }
  // Last resort: resolve from cwd
  return path.resolve(process.cwd(), "src/bun-client/migrations");
}

export interface CreateClientOptions {
  dbPath: string; // ":memory:" for tests, or absolute file path
  notesDir: string;
  /** Directory for the settings file. Defaults to notesDir. */
  settingsDir?: string;
}

export interface NodeClient {
  db: BetterSQLite3Database<typeof schema>;
  /** The raw better-sqlite3 Database, exposed for manual SQL when needed */
  sqlite: Database.Database;
  notesDir: string;
  preferences: PreferencesClient;
  journals: JournalsClient;
  documents: DocumentsClient;
  files: NodeFilesClient;
  indexer: IndexerClient;
  bulkOperations: BulkOperationsClient;
  tags: TagsClient;
  importer: ImporterClient;
}

/**
 * Creates a node-client instance: opens (or creates) a SQLite database,
 * runs Drizzle migrations, creates the FTS5 virtual table, and returns
 * a typed Drizzle db handle.
 */
export async function createClient(
  opts: CreateClientOptions,
): Promise<NodeClient> {
  const sqlite = new Database(opts.dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.exec("PRAGMA journal_mode = WAL;");
  // Enable foreign keys
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const db = drizzle(sqlite, { schema });

  const migrationsFolder = resolveMigrationsFolder();

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
    // Use the 0000 entry's own journal timestamp (not Date.now()) so that
    // later migrations — whose journal `when` is necessarily greater than
    // 0000's — still get picked up by Drizzle's "when > last created_at" check.
    console.log(
      "[node-client] Existing schema detected, stamping Drizzle migration journal",
    );
    const journal = JSON.parse(
      fs.readFileSync(
        path.join(migrationsFolder, "meta/_journal.json"),
        "utf-8",
      ),
    ) as { entries: { tag: string; when: number }[] };
    const initialEntry = journal.entries[0];
    sqlite.exec(
      `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${initialEntry.tag}', ${initialEntry.when})`,
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
  const files = new NodeFilesClient(opts.notesDir);
  const journals = new JournalsClient(db, files, preferences);
  const documents = new DocumentsClient(db, files);
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
    opts.notesDir,
  );

  return {
    db,
    sqlite,
    notesDir: opts.notesDir,
    preferences,
    journals,
    documents,
    files,
    indexer,
    bulkOperations,
    tags,
    importer,
  };
}
