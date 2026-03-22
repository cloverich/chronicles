import { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import { createClient, type NodeClient } from "./factory";
import { documentTags, documents, journals } from "./schema";

let client: NodeClient;
let notesDir: string;

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("factory", () => {
  test("migrations run and tables exist", async () => {
    const result = await client.db.select().from(journals);
    assert.deepStrictEqual(result, []);
  });

  test("documents table is queryable", async () => {
    const result = await client.db.select().from(documents);
    assert.deepStrictEqual(result, []);
  });

  test("document_tags table is queryable", async () => {
    const result = await client.db.select().from(documentTags);
    assert.deepStrictEqual(result, []);
  });

  test("FTS5 virtual table exists", () => {
    const row = client.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'",
      )
      .get() as { name: string } | null;
    assert.notStrictEqual(row, null);
    assert.strictEqual(row!.name, "documents_fts");
  });

  test("foreign keys are enabled", () => {
    const row = client.sqlite.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    assert.strictEqual(row.foreign_keys, 1);
  });
});
