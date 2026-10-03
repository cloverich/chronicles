import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "./factory";

/**
 * Upgrade tests: build a file-backed database at an older migration, seed it
 * with synthetic rows in that schema, then open it with createClient (which
 * applies the remaining migrations) and check the data survived.
 */

const MIGRATIONS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const scratch = fs.mkdtempSync(path.join(tmpdir(), "chronicles-migrations-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

/** A database file migrated up to and including migration `lastIdx`. */
function dbAtMigration(name: string, lastIdx: number) {
  const folder = path.join(scratch, `${name}-migrations`);
  fs.cpSync(MIGRATIONS, folder, { recursive: true });
  const journalPath = path.join(folder, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.filter((e: any) => e.idx <= lastIdx);
  fs.writeFileSync(journalPath, JSON.stringify(journal));

  const dbPath = path.join(scratch, `${name}.db`);
  const sqlite = new Database(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  migrate(drizzle(sqlite), { migrationsFolder: folder });
  return { dbPath, sqlite };
}

async function openUpgraded(name: string, dbPath: string) {
  const notesDir = path.join(scratch, `${name}-notes`);
  fs.mkdirSync(notesDir, { recursive: true });
  return createClient({ dbPath, notesDir });
}

describe("0003_journal_ids", () => {
  test("assigns journal ids and keeps every document", async () => {
    const { dbPath, sqlite } = dbAtMigration("journal-ids", 2);
    sqlite.exec(`
      INSERT INTO journals (name, createdAt, updatedAt) VALUES
        ('work', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
        ('empty', '2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z');
      INSERT INTO documents (id, journal, title, frontmatter, content, createdAt, updatedAt) VALUES
        ('03awvyp9xobkv9t1jmmtiz0bp', 'work', 'One', '{}', 'Body one', '2024-01-02T00:00:00.000Z', '2024-01-02T00:00:00.000Z'),
        ('03b3m6xaiod1fz6mvkjmvb3jc', 'work', 'Two', '{}', 'Body two', '2024-01-03T00:00:00.000Z', '2024-01-03T00:00:00.000Z');
      INSERT INTO document_tags (documentId, tag) VALUES ('03awvyp9xobkv9t1jmmtiz0bp', 'kept');
    `);
    sqlite.close();

    const client = await openUpgraded("journal-ids", dbPath);
    const journals = await client.journals.list();
    const work = journals.find((j) => j.name === "work")!;
    assert.match(work.id, /^[0-9a-z]{25}$/);
    assert.ok(journals.find((j) => j.name === "empty")!.id !== work.id);

    const doc = await client.documents.findById({
      id: "03awvyp9xobkv9t1jmmtiz0bp",
    });
    assert.strictEqual(doc.journal, "work");
    assert.strictEqual(doc.content, "Body one");
    assert.deepStrictEqual(doc.frontMatter.tags, ["kept"]);

    const counts = await client.journals.listWithCounts();
    assert.strictEqual(counts.find((j) => j.name === "work")!.count, 2);

    // Renaming is now a single row update; documents follow by id.
    await client.journals.rename({ name: "work", archived: false }, "job");
    const renamed = await client.documents.findById({
      id: "03b3m6xaiod1fz6mvkjmvb3jc",
    });
    assert.strictEqual(renamed.journal, "job");

    const fk = client.sqlite.prepare("PRAGMA foreign_keys").get() as any;
    assert.strictEqual(fk.foreign_keys, 1);
  });
});
