import sqlite3, { Database } from "better-sqlite3";
export { Database } from "better-sqlite3";
import promisify from "fs";

let db: Database;

// https://github.com/mapbox/node-sqlite3
export function createDb(
  url: string = ":memory:",
  reschema: boolean = false
): Database {
  if (db) return db;
  db = new sqlite3(url);
  recreateSchema(db, reschema);

  return db;
}

// Exported to support naively re-indexing by deleting and re-adding
// everything
export async function recreateSchema(db: Database, reschema: boolean) {
  if (reschema) {
    console.log("[recreateSchema] Recreating schema");
    db.exec(`DROP TABLE IF EXISTS nodes`);
    db.exec("DROP TABLE IF EXISTS journals");
  }

  // I don't have migrations yet. Or users. Do this for now,
  // delete this later. Add real migrations.
  try {
    db.exec(
      `ALTER TABLE journals ADD COLUMN period TEXT NOT NULL DEFAULT "day"`
    );
  } catch (err) {}

  db.exec(`CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT "day" -- day, month, year
  )`);

  db.exec(
    `CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal TEXT,
      date TEXT,
      idx INTEGER, -- not needed if we pk!
      type TEXT,
      contents TEXT,
      attributes TEXT
    )`
  );
}
