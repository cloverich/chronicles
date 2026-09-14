import { eq } from "drizzle-orm";
import { existsSync, mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { createClient } from "./factory";
import * as schema from "./schema";

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
    const id = await client.documents.createDocument({
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
    const id = await client.documents.createDocument({
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

    // createDocument no longer writes markdown files at all.
    const filepath = path.join(notesDir, journalName, `${id}.md`);
    assert.strictEqual(existsSync(filepath), false);

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
    const id = await client.documents.createDocument({
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
    const id = await client.documents.createDocument({
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

  test("changing journal updates the row and search reflects it", async () => {
    const id = await client.documents.createDocument({
      journal: journalName,
      content: "Original content",
      frontMatter: {
        title: "Original Title",
        tags: ["tagA"],
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      },
    });

    let resultsOrig = await client.documents.search({
      journals: [journalName],
    });
    assert.ok(resultsOrig.data.some((d) => d.id === id));

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

    resultsOrig = await client.documents.search({ journals: [journalName] });
    assert.ok(!resultsOrig.data.some((d) => d.id === id));

    const resultsNew = await client.documents.search({
      journals: [journal2Name],
    });
    assert.ok(resultsNew.data.some((d) => d.id === id));
  });

  test("updateDocument of an unknown id rejects with [DOCUMENT_NOT_FOUND]", async () => {
    await assert.rejects(
      client.documents.updateDocument({
        id: "does-not-exist",
        journal: journalName,
        content: "content",
        frontMatter: {
          tags: [],
          createdAt: "2024-02-01T00:00:00.000Z",
          updatedAt: "2024-02-01T00:00:00.000Z",
        },
      }),
      /\[DOCUMENT_NOT_FOUND\]/,
    );
  });
});

describe("del", () => {
  test("deleted doc is not retrievable and removed from FTS", async () => {
    const id = await client.documents.createDocument({
      journal: journalName,
      content: "To be deleted",
      frontMatter: {
        title: "Delete Me",
        tags: [],
        createdAt: "2024-03-01T00:00:00.000Z",
        updatedAt: "2024-03-01T00:00:00.000Z",
      },
    });

    await client.documents.del(id);

    await assert.rejects(
      client.documents.findById({ id }),
      /\[DOCUMENT_NOT_FOUND\]/,
    );

    const ftsRow = client.sqlite
      .prepare("SELECT id FROM documents_fts WHERE id = ?")
      .get(id);
    assert.strictEqual(ftsRow, undefined);
  });
});

describe("derived rows (links, images, FTS)", () => {
  test("note links and images produce document_links and image_links rows", async () => {
    const targetJournal = "link-target-journal";
    await client.journals.create({ name: targetJournal });
    const targetId = "target-note-id";

    const content =
      "See [related note](../link-target-journal/target-note-id.md) and " +
      "![an image](chronicles://../_attachments/a.png)";

    const id = await client.documents.createDocument({
      journal: journalName,
      content,
      frontMatter: {
        title: "Links and images",
        tags: [],
        createdAt: "2024-05-01T00:00:00.000Z",
        updatedAt: "2024-05-01T00:00:00.000Z",
      },
    });

    const linkRows = await client.db
      .select()
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, id));
    assert.strictEqual(linkRows.length, 1);
    assert.strictEqual(linkRows[0].targetId, targetId);
    assert.strictEqual(linkRows[0].targetJournal, targetJournal);

    const imageRows = await client.db
      .select()
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, id));
    assert.strictEqual(imageRows.length, 1);
    assert.strictEqual(
      imageRows[0].imagePath,
      "chronicles://../_attachments/a.png",
    );

    // Removing the link and image on update clears the derived rows.
    await client.documents.updateDocument({
      id,
      journal: journalName,
      content: "No more links or images here",
      frontMatter: {
        title: "Links and images",
        tags: [],
        createdAt: "2024-05-01T00:00:00.000Z",
        updatedAt: "2024-05-02T00:00:00.000Z",
      },
    });

    const linkRowsAfter = await client.db
      .select()
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, id));
    assert.strictEqual(linkRowsAfter.length, 0);

    const imageRowsAfter = await client.db
      .select()
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, id));
    assert.strictEqual(imageRowsAfter.length, 0);

    // del removes the row and its FTS entry.
    await client.documents.del(id);
    await assert.rejects(
      client.documents.findById({ id }),
      /\[DOCUMENT_NOT_FOUND\]/,
    );
    const ftsRow = client.sqlite
      .prepare("SELECT id FROM documents_fts WHERE id = ?")
      .get(id);
    assert.strictEqual(ftsRow, undefined);
  });
});

describe("atomicity", () => {
  test("createDocument into a nonexistent journal rejects and leaves no partial state", async () => {
    const id = "atomic-fk-fail-id";

    await assert.rejects(
      client.documents.createDocument({
        id,
        journal: "journal-does-not-exist",
        content: "orphan content",
        frontMatter: {
          title: "Should not persist",
          tags: ["should-not-persist"],
          createdAt: "2024-06-01T00:00:00.000Z",
          updatedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
    );

    const ftsRow = client.sqlite
      .prepare("SELECT id FROM documents_fts WHERE id = ?")
      .get(id);
    assert.strictEqual(ftsRow, undefined);

    const tagRow = client.sqlite
      .prepare("SELECT * FROM document_tags WHERE documentId = ?")
      .get(id);
    assert.strictEqual(tagRow, undefined);
  });
});

describe("frontmatter column ownership", () => {
  test("frontmatter JSON column holds only user keys", async () => {
    const id = await client.documents.createDocument({
      journal: journalName,
      content: "some content",
      frontMatter: {
        title: "Has Column Owned Keys",
        tags: ["a", "b"],
        createdAt: "2024-07-01T00:00:00.000Z",
        updatedAt: "2024-07-01T00:00:00.000Z",
        mood: "x",
      },
    });

    const row = client.sqlite
      .prepare("SELECT frontmatter FROM documents WHERE id = ?")
      .get(id) as { frontmatter: string };

    assert.deepStrictEqual(JSON.parse(row.frontmatter), { mood: "x" });
  });
});

describe("search", () => {
  test("list by journal returns only that journal's docs", async () => {
    const otherJournal = "other-journal";
    await client.journals.create({ name: otherJournal });

    const idA = await client.documents.createDocument({
      journal: journalName,
      content: "Doc in test-journal",
      frontMatter: {
        title: "Journal A Doc",
        tags: [],
        createdAt: "2024-04-01T00:00:00.000Z",
        updatedAt: "2024-04-01T00:00:00.000Z",
      },
    });

    const idB = await client.documents.createDocument({
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

    const idOld = await client.documents.createDocument({
      journal,
      content: "Older",
      frontMatter: {
        title: "Older",
        tags: [],
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
    });

    const idNew = await client.documents.createDocument({
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

describe("rebuildDerived", () => {
  test("regenerates FTS, document_links, and image_links after corruption; leaves tags untouched", async () => {
    const targetJournal = "rebuild-target-journal";
    await client.journals.create({ name: targetJournal });
    const targetId = "rebuild-target-note-id";

    const content =
      "See [related note](../rebuild-target-journal/rebuild-target-note-id.md) and " +
      "![an image](chronicles://../_attachments/rebuild.png). Findable via giraffewords.";

    const id = await client.documents.createDocument({
      journal: journalName,
      content,
      frontMatter: {
        title: "Rebuild me",
        tags: ["rebuild-tag"],
        createdAt: "2024-06-01T00:00:00.000Z",
        updatedAt: "2024-06-01T00:00:00.000Z",
      },
    });

    const linkRowsBefore = await client.db
      .select()
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, id));
    const imageRowsBefore = await client.db
      .select()
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, id));
    const tagRowsBefore = await client.db
      .select()
      .from(schema.documentTags)
      .where(eq(schema.documentTags.documentId, id));

    assert.strictEqual(linkRowsBefore.length, 1);
    assert.strictEqual(imageRowsBefore.length, 1);
    assert.strictEqual(tagRowsBefore.length, 1);

    // Corrupt all derived state (but not tags, which are canonical).
    client.sqlite.exec("DELETE FROM documents_fts");
    client.sqlite.exec("DELETE FROM document_links");
    client.sqlite.exec("DELETE FROM image_links");

    const searchDuringCorruption = await client.documents.search({
      texts: ["giraffewords"],
    });
    assert.strictEqual(searchDuringCorruption.data.length, 0);

    const { count } = await client.documents.rebuildDerived();
    assert.ok(count >= 1);

    const searchAfter = await client.documents.search({
      texts: ["giraffewords"],
    });
    assert.ok(searchAfter.data.some((d) => d.id === id));

    const linkRowsAfter = await client.db
      .select()
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, id));
    const imageRowsAfter = await client.db
      .select()
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, id));
    const tagRowsAfter = await client.db
      .select()
      .from(schema.documentTags)
      .where(eq(schema.documentTags.documentId, id));

    assert.deepStrictEqual(
      linkRowsAfter.map((r) => ({
        targetId: r.targetId,
        targetJournal: r.targetJournal,
      })),
      linkRowsBefore.map((r) => ({
        targetId: r.targetId,
        targetJournal: r.targetJournal,
      })),
    );
    assert.deepStrictEqual(
      imageRowsAfter.map((r) => r.imagePath),
      imageRowsBefore.map((r) => r.imagePath),
    );
    // Tags are canonical, not derived — untouched by rebuildDerived.
    assert.deepStrictEqual(tagRowsAfter, tagRowsBefore);
  });
});

describe("deleteAll", () => {
  test("removes notes, tags, derived rows, journals, and imports", async () => {
    const dir = mkdtempSync(tmpdir() + "/chronicles-reset-");
    const c = await createClient({ dbPath: ":memory:", notesDir: dir });
    await c.journals.create({ name: "j1" });
    await c.documents.createDocument({
      journal: "j1",
      content: "hello ![x](../_attachments/a.png) [l](../j1/abc.md)",
      frontMatter: {
        title: "T",
        tags: ["t"],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });
    await c.documents.deleteAll();
    await c.journals.ensureDefault();

    const count = (t: string) =>
      (c.sqlite.prepare(`SELECT count(*) as n FROM ${t}`).get() as any).n;
    for (const t of [
      "documents",
      "document_tags",
      "document_links",
      "image_links",
      "documents_fts",
      "imports",
    ]) {
      assert.strictEqual(count(t), 0, t);
    }
    assert.deepStrictEqual(
      (await c.journals.list()).map((j) => j.name),
      ["default_journal"],
    );
    assert.strictEqual(
      await c.preferences.get("defaultJournal"),
      "default_journal",
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
