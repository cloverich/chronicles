/**
 * Seed a disposable Chronicles profile (synthetic notes) whose database is at
 * an older migration, to exercise upgrades in the real app:
 *
 *   ELECTRON_RUN_AS_NODE=1 electron --import tsx scripts/scratch-profile.ts <dir> <lastMigrationIdx>
 *   HEADLESS=true CHRONICLES_USER_DATA=<dir>/userData CHRONICLES_SETTINGS_DIR=<dir>/settings yarn start
 *
 * Replaces <dir>; refuses a non-empty directory it did not create.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import { runMigrations } from "../src/node-client/factory";
const [dir, idxStr] = process.argv.slice(2);
const last = Number(idxStr);
const MARKER = ".chronicles-scratch";
if (
  fs.existsSync(dir) &&
  fs.readdirSync(dir).length > 0 &&
  !fs.existsSync(path.join(dir, MARKER))
) {
  throw new Error(`${dir} is not empty and not a scratch profile; refusing`);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, MARKER), "");
for (const d of ["userData", "settings", "notes/_attachments"])
  fs.mkdirSync(path.join(dir, d), { recursive: true });
const folder = path.join(dir, "migrations");
fs.cpSync("src/node-client/migrations", folder, { recursive: true });
const jp = path.join(folder, "meta/_journal.json");
const j = JSON.parse(fs.readFileSync(jp, "utf8"));
j.entries = j.entries.filter((e: any) => e.idx <= last);
fs.writeFileSync(jp, JSON.stringify(j));
const sqlite = new Database(path.join(dir, "userData/chronicles.db"));
runMigrations(sqlite, drizzle(sqlite), folder);
const A = "03awvyp9xobkv9t1jmmtiz0bp",
  B = "03b3m6xaiod1fz6mvkjmvb3jc";
fs.writeFileSync(
  path.join(dir, "notes/_attachments/03awvyp9xobkv9t1jmmtiz0bq.png"),
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);
sqlite.exec(`
INSERT INTO journals (name, createdAt, updatedAt) VALUES ('work', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'), ('personal', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');
INSERT INTO documents (id, journal, title, frontmatter, content, createdAt, updatedAt) VALUES
 ('${A}', 'work', 'Scratch one', '{}', 'Hello. See [two](../personal/${B}.md).\n\n![px](../_attachments/03awvyp9xobkv9t1jmmtiz0bq.png)\n', '2024-01-02T00:00:00.000Z', '2024-01-02T00:00:00.000Z'),
 ('${B}', 'personal', 'Scratch two', '{}', 'Back to [one](../work/${A}.md).\n', '2024-01-03T00:00:00.000Z', '2024-01-03T00:00:00.000Z');
INSERT INTO document_tags VALUES ('${A}', 'smoke');
`);
sqlite.close();
fs.writeFileSync(
  path.join(dir, "settings/settings.json"),
  JSON.stringify({
    notesDir: path.join(dir, "notes"),
    defaultJournal: "work",
    archivedJournals: { work: false, personal: false },
  }),
);
fs.rmSync(folder, { recursive: true });
console.log("seeded", dir);
