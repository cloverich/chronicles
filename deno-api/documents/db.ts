import { DB } from "../deps.ts";

let db: DB;

export function createDb(
  url: string = ":memory:",
  reschema: boolean = false
): DB {
  if (db) return db;
  db = new DB(url);
  if (reschema) createSchema(db);

  return db;
}

function createSchema(db: DB) {
  db.query(`DROP TABLE IF EXISTS nodes`);
  db.query("DROP TABLE IF EXISTS journals");

  db.query(`CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL
  )`);

  db.query(
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
