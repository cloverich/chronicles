import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { type BunClient, createClient } from "./factory";
import { documents, documentTags, journals } from "./schema";

let client: BunClient;
let notesDir: string;

beforeAll(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("factory", () => {
  test("migrations run and tables exist", async () => {
    const result = await client.db.select().from(journals);
    expect(result).toEqual([]);
  });

  test("documents table is queryable", async () => {
    const result = await client.db.select().from(documents);
    expect(result).toEqual([]);
  });

  test("document_tags table is queryable", async () => {
    const result = await client.db.select().from(documentTags);
    expect(result).toEqual([]);
  });

  test("FTS5 virtual table exists", () => {
    const row = client.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'",
      )
      .get() as { name: string } | null;
    expect(row).not.toBeNull();
    expect(row!.name).toBe("documents_fts");
  });

  test("foreign keys are enabled", () => {
    const row = client.sqlite.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    expect(row.foreign_keys).toBe(1);
  });
});
