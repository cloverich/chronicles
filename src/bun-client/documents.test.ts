import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;
let journalName: string;

beforeAll(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-docs-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });

  // Create a journal to house the documents
  journalName = "test-journal";
  await client.journals.create({ name: journalName });
});

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("createDocument / findById", () => {
  test("create doc is retrievable by id", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "Hello world",
      frontMatter: {
        title: "My Doc",
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    const doc = await client.documents.findById({ id });
    expect(doc.id).toBe(id);
    expect(doc.journal).toBe(journalName);
    expect(doc.frontMatter.title).toBe("My Doc");
    expect(doc.content).toBe("Hello world");
  });

  test("findById throws [DOCUMENT_NOT_FOUND] for missing id", async () => {
    await expect(
      client.documents.findById({ id: "nonexistent-id" }),
    ).rejects.toThrow("[DOCUMENT_NOT_FOUND]");
  });
});

describe("updateDocument", () => {
  test("update changes content and frontMatter", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "Original content",
      frontMatter: {
        title: "Original Title",
        tags: ["tagA"],
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      },
    });

    await client.documents.updateDocument({
      id,
      journal: journalName,
      content: "Updated content",
      frontMatter: {
        title: "Updated Title",
        tags: ["tagB"],
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-02T00:00:00.000Z",
      },
    });

    const doc = await client.documents.findById({ id });
    expect(doc.content).toBe("Updated content");
    expect(doc.frontMatter.title).toBe("Updated Title");
    expect(doc.frontMatter.tags).toEqual(["tagB"]);
  });
});

describe("del", () => {
  test("deleted doc is not retrievable", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "To be deleted",
      frontMatter: {
        title: "Delete Me",
        tags: [],
        createdAt: "2024-03-01T00:00:00.000Z",
        updatedAt: "2024-03-01T00:00:00.000Z",
      },
    });

    await client.documents.del(id, journalName);

    await expect(client.documents.findById({ id })).rejects.toThrow(
      "[DOCUMENT_NOT_FOUND]",
    );
  });
});

describe("search", () => {
  test("list by journal returns only that journal's docs", async () => {
    const otherJournal = "other-journal";
    await client.journals.create({ name: otherJournal });

    const [idA] = await client.documents.createDocument({
      journal: journalName,
      content: "Doc in test-journal",
      frontMatter: {
        title: "Journal A Doc",
        tags: [],
        createdAt: "2024-04-01T00:00:00.000Z",
        updatedAt: "2024-04-01T00:00:00.000Z",
      },
    });

    const [idB] = await client.documents.createDocument({
      journal: otherJournal,
      content: "Doc in other-journal",
      frontMatter: {
        title: "Journal B Doc",
        tags: [],
        createdAt: "2024-04-02T00:00:00.000Z",
        updatedAt: "2024-04-02T00:00:00.000Z",
      },
    });

    const results = await client.documents.search({
      journals: [journalName],
    });

    const ids = results.data.map((d) => d.id);
    expect(ids).toContain(idA);
    expect(ids).not.toContain(idB);
  });

  test("returns results sorted by createdAt desc", async () => {
    const journal = "sort-journal";
    await client.journals.create({ name: journal });

    const [idOld] = await client.documents.createDocument({
      journal,
      content: "Older",
      frontMatter: {
        title: "Older",
        tags: [],
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
    });

    const [idNew] = await client.documents.createDocument({
      journal,
      content: "Newer",
      frontMatter: {
        title: "Newer",
        tags: [],
        createdAt: "2023-06-01T00:00:00.000Z",
        updatedAt: "2023-06-01T00:00:00.000Z",
      },
    });

    const results = await client.documents.search({ journals: [journal] });
    expect(results.data[0].id).toBe(idNew);
    expect(results.data[1].id).toBe(idOld);
  });
});

describe("getSyncMeta", () => {
  test("returns mtime, size, and contentHash after create", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "Sync meta test",
      frontMatter: {
        title: "Sync Meta",
        tags: [],
        createdAt: "2024-05-01T00:00:00.000Z",
        updatedAt: "2024-05-01T00:00:00.000Z",
      },
    });

    const meta = await client.documents.getSyncMeta(id);
    expect(meta.mtime).toBeGreaterThan(0);
    expect(meta.size).toBeGreaterThan(0);
    expect(typeof meta.contentHash).toBe("string");
    expect(meta.contentHash!.length).toBe(64); // SHA-256 hex
  });

  test("returns nulls for unknown id", async () => {
    const meta = await client.documents.getSyncMeta("does-not-exist");
    expect(meta.mtime).toBeNull();
    expect(meta.size).toBeNull();
    expect(meta.contentHash).toBeNull();
  });
});
