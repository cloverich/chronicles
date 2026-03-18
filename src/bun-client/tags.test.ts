import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { createClient } from "./factory";

type BunClient = Awaited<ReturnType<typeof createClient>>;

/** Creates an isolated in-memory client; caller must call cleanup(). */
async function makeClient() {
  const dir = mkdtempSync(tmpdir() + "/chronicles-tags-test-");
  const client = await createClient({ dbPath: ":memory:", notesDir: dir });
  return {
    client,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Seed a client with known documents for tag tests. */
async function seedTagDocs(c: BunClient) {
  await c.journals.create({ name: "journal-a" });
  await c.journals.create({ name: "journal-b" });

  // Doc One: tags [work, personal] in journal-a
  await c.documents.createDocument({
    journal: "journal-a",
    content: "First document",
    frontMatter: {
      title: "Doc One",
      tags: ["work", "personal"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });

  // Doc Two: tags [work, hobby] in journal-a
  await c.documents.createDocument({
    journal: "journal-a",
    content: "Second document",
    frontMatter: {
      title: "Doc Two",
      tags: ["work", "hobby"],
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  });

  // Doc Three: tags [personal] in journal-b
  await c.documents.createDocument({
    journal: "journal-b",
    content: "Third document",
    frontMatter: {
      title: "Doc Three",
      tags: ["personal"],
      createdAt: "2024-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    },
  });

  // Doc Four: no tags in journal-b
  await c.documents.createDocument({
    journal: "journal-b",
    content: "No tags here",
    frontMatter: {
      title: "No Tags Doc",
      tags: [],
      createdAt: "2024-01-04T00:00:00.000Z",
      updatedAt: "2024-01-04T00:00:00.000Z",
    },
  });
}

describe("TagsClient", () => {
  let client: BunClient;
  let cleanup: () => void;

  beforeAll(async () => {
    const ctx = await makeClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    await seedTagDocs(client);
  });

  afterAll(() => cleanup());

  test("all() returns empty array on fresh DB", async () => {
    const ctx = await makeClient();
    try {
      expect(await ctx.client.tags.all()).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });

  test("all() returns distinct sorted tags", async () => {
    // work appears on 2 docs, personal on 2, hobby on 1 — all() should deduplicate
    expect(await client.tags.all()).toEqual(["hobby", "personal", "work"]);
  });

  test("all() is not affected by documents with no tags", async () => {
    // Doc Four has no tags — list should be unchanged
    expect(await client.tags.all()).toEqual(["hobby", "personal", "work"]);
  });

  test("allWithCounts() returns empty array on fresh DB", async () => {
    const ctx = await makeClient();
    try {
      expect(await ctx.client.tags.allWithCounts()).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });

  test("allWithCounts() returns correct counts sorted by tag name", async () => {
    const results = await client.tags.allWithCounts();
    expect(results).toEqual([
      { tag: "hobby", count: 1 },
      { tag: "personal", count: 2 },
      { tag: "work", count: 2 },
    ]);
    // Verify count is a number, not a string from SQLite
    expect(typeof results[0].count).toBe("number");
  });
});
