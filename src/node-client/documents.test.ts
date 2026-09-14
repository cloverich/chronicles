import { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { open } from "node:fs/promises";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;
let journalName: string;

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-docs-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });

  // Create a journal to house the documents
  journalName = "test-journal";
  await client.journals.create({ name: journalName });
});

after(() => {
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
    assert.strictEqual(doc.id, id);
    assert.strictEqual(doc.journal, journalName);
    assert.strictEqual(doc.frontMatter.title, "My Doc");
    assert.strictEqual(doc.content, "Hello world");
  });

  test("findById throws [DOCUMENT_NOT_FOUND] for missing id", async () => {
    await assert.rejects(
      client.documents.findById({ id: "nonexistent-id" }),
      /\[DOCUMENT_NOT_FOUND\]/,
    );
  });

  test("findById reads from the database only — no .md file required", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "No file needed",
      frontMatter: {
        title: "DB Only",
        tags: ["zeta", "alpha"],
        createdAt: "2024-01-05T00:00:00.000Z",
        updatedAt: "2024-01-05T00:00:00.000Z",
        mood: "curious",
      },
    });

    // Prove there is no filesystem dependency: delete the .md file entirely.
    const filepath = path.join(notesDir, journalName, `${id}.md`);
    rmSync(filepath);

    const doc = await client.documents.findById({ id });
    assert.strictEqual(doc.id, id);
    assert.strictEqual(doc.journal, journalName);
    assert.strictEqual(doc.content, "No file needed");
    assert.strictEqual(doc.frontMatter.title, "DB Only");
    assert.deepStrictEqual(doc.frontMatter.tags, ["alpha", "zeta"]);
    assert.strictEqual(doc.frontMatter.createdAt, "2024-01-05T00:00:00.000Z");
    assert.strictEqual(doc.frontMatter.updatedAt, "2024-01-05T00:00:00.000Z");
    assert.strictEqual(doc.frontMatter.mood, "curious");
  });

  test("findById omits title when the document has none", async () => {
    const [id] = await client.documents.createDocument({
      journal: journalName,
      content: "Untitled body",
      frontMatter: {
        tags: [],
        createdAt: "2024-01-06T00:00:00.000Z",
        updatedAt: "2024-01-06T00:00:00.000Z",
      },
    });

    const doc = await client.documents.findById({ id });
    assert.strictEqual(doc.frontMatter.title, undefined);
  });
});

describe("updateDocument", () => {
  let journal2Name: string;

  before(async () => {
    journal2Name = "test-journal2";
    await client.journals.create({ name: journal2Name });
  });

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
    assert.strictEqual(doc.content, "Updated content");
    assert.strictEqual(doc.frontMatter.title, "Updated Title");
    assert.deepStrictEqual(doc.frontMatter.tags, ["tagB"]);
  });

  // The write path still mirrors documents to disk (task 3 removes that), so the
  // old file should still be cleaned up on journal move. findById no longer exposes
  // a filepath, so we compute the on-disk path the same way the client does.
  test("changing journal name removes old document from disk", async () => {
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

    const originalFilepath = path.join(notesDir, journalName, `${id}.md`);
    await assert.doesNotReject(
      open(originalFilepath),
      "Document should exist on disk at originalFilePath",
    );

    await client.documents.updateDocument({
      id,
      journal: journal2Name,
      content: "Original content",
      frontMatter: {
        title: "Original Title",
        tags: ["tagA"],
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      },
    });

    const doc = await client.documents.findById({ id });
    assert.strictEqual(doc.journal, journal2Name);

    await assert.rejects(
      open(originalFilepath),
      "Original file path should no longer exist",
    );
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

    await assert.rejects(
      client.documents.findById({ id }),
      /\[DOCUMENT_NOT_FOUND\]/,
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
    assert.ok(ids.includes(idA));
    assert.ok(!ids.includes(idB));
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
    assert.strictEqual(results.data[0].id, idNew);
    assert.strictEqual(results.data[1].id, idOld);
  });
});
