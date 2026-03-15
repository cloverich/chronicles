import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateClientOptions {
  dbPath: string; // ":memory:" for tests, or absolute file path
  notesDir: string;
}

export interface BunClient {
  db: BunSQLiteDatabase<typeof schema>;
  /** The raw bun:sqlite Database, exposed for manual SQL when needed */
  sqlite: Database;
  notesDir: string;
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
  const migrationsFolder = path.resolve(__dirname, "migrations");
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

  return {
    db,
    sqlite,
    notesDir: opts.notesDir,
  };
}
