import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { SourceType } from "../preload/client/importer/SourceType";
import { createClient } from "./factory";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to the fixture directory (project root relative)
const FIXTURE_DIR = path.resolve(__dirname, "../preload/client/importer/test");

// Files referenced by the Notion markdown notes — we create minimal binary stubs
// so the importer can find and copy them.
interface FileStub {
  relativePath: string; // relative to FIXTURE_DIR
  type: "png" | "jpg";
}

const NOTION_FILE_STUBS: FileStub[] = [
  {
    relativePath:
      "notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/Screen_Shot_2022-05-28_at_7.06.54_AM.png",
    type: "png",
  },
  {
    relativePath:
      "notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/Screen_Shot_2022-05-28_at_7.07.08_AM.png",
    type: "png",
  },
  {
    relativePath:
      "notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/IMG_1988.jpg",
    type: "jpg",
  },
  {
    relativePath:
      "notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_2.24.52_PM.png",
    type: "png",
  },
  {
    relativePath:
      "notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_3.43.30_PM.png",
    type: "png",
  },
  {
    relativePath:
      "notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_2.23.46_PM.png",
    type: "png",
  },
];

// Minimal valid binary headers for each type
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

/**
 * Write minimal binary file stubs into a copy of the fixture directory so the
 * importer can find and copy them without tracking binaries in git.
 */
function generateFileStubs(baseDir: string, stubs: FileStub[]) {
  for (const stub of stubs) {
    const absPath = path.join(baseDir, stub.relativePath);
    mkdirSync(path.dirname(absPath), { recursive: true });
    const header = stub.type === "png" ? PNG_HEADER : JPG_HEADER;
    writeFileSync(absPath, header);
  }
}

/**
 * Copy the fixture directory to a temp location and write binary stubs there.
 * Returns the path to the temp copy.
 */
function prepareFixtureDir(): string {
  const tmpBase = mkdtempSync(
    path.join(tmpdir(), "chronicles-import-fixtures-"),
  );
  cpSync(FIXTURE_DIR, tmpBase, { recursive: true });
  generateFileStubs(tmpBase, NOTION_FILE_STUBS);
  return tmpBase;
}

// ---------------------------------------------------------------------------
// Notion import suite
// ---------------------------------------------------------------------------

describe("Notion import", () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  let notesDir: string;
  let fixtureDir: string;

  before(async () => {
    notesDir = mkdtempSync(path.join(tmpdir(), "chronicles-notion-test-"));
    client = await createClient({ dbPath: ":memory:", notesDir });
    // The indexer reads notesDir from preferences; set it so indexer.index() works
    await client.preferences.set("notesDir", notesDir);

    fixtureDir = prepareFixtureDir();
    const notionImportDir = path.join(fixtureDir, "notion");
    await client.importer.import(notionImportDir, SourceType.Notion);
  });

  after(() => {
    rmSync(notesDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  test("imports two notes", async () => {
    const importedNotes = await client.db.select().from(schema.importNotes);
    assert.strictEqual(importedNotes.length, 2);
    for (const note of importedNotes) {
      assert.strictEqual(note.status, "note_created");
    }
  });

  test("imports six files", async () => {
    const importedFiles = await client.db.select().from(schema.importFiles);
    assert.strictEqual(importedFiles.length, 6);
    for (const file of importedFiles) {
      assert.strictEqual(file.status, "complete");
    }
  });

  test("import record is marked complete", async () => {
    const imports = await client.db.select().from(schema.imports);
    assert.strictEqual(imports.length, 1);
    assert.strictEqual(imports[0].status, "complete");
  });

  test("documents are visible via search after import + indexing", async () => {
    const result = await client.documents.search({});
    assert.strictEqual(result.data.length, 2);
  });

  test("The Portland Drive is in the Documents journal", async () => {
    const result = await client.documents.search({
      titles: ["Portland Drive"],
    });
    assert.strictEqual(result.data.length, 1);
    const doc = result.data[0];
    assert.strictEqual(doc.journal, "Documents");
  });

  test("The Portland Drive has correct frontmatter (tags, dates, extra fields)", async () => {
    const result = await client.documents.search({
      titles: ["Portland Drive"],
    });
    const row = result.data[0];
    const doc = await client.documents.findById({ id: row.id });

    // Tags parsed from Notion inline frontmatter "Tags: review"
    assert.deepStrictEqual(doc.frontMatter.tags, ["review"]);

    // createdAt from "createdAt: May 28, 2022 7:09 AM" in the note header
    assert.strictEqual(doc.frontMatter.createdAt?.slice(0, 7), "2022-05");

    // Extra Notion-style frontmatter fields preserved
    assert.strictEqual(doc.frontMatter.title, "The Portland Drive");
    assert.strictEqual(doc.frontMatter["Created By"], "chris");
    assert.strictEqual(doc.frontMatter.published, "No");
  });

  test("Road Trip is in the notion journal (inferred from folder)", async () => {
    const result = await client.documents.search({
      titles: ["West coast road trip"],
    });
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].journal, "notion");
  });

  test("cross-document link from Portland Drive to Road Trip is remapped", async () => {
    const portlandSearch = await client.documents.search({
      titles: ["Portland Drive"],
    });
    const roadTripSearch = await client.documents.search({
      titles: ["West coast road trip"],
    });

    const portlandDoc = await client.documents.findById({
      id: portlandSearch.data[0].id,
    });
    const roadTripId = roadTripSearch.data[0].id;

    // The link should be remapped from the original relative Notion path to a
    // chronicles-style relative path: ../notion/<id>.md
    assert.ok(portlandDoc.content.includes(`../notion/${roadTripId}.md`));
  });

  test("attachments are copied to _attachments directory", async () => {
    const attachmentsDir = path.join(notesDir, "_attachments");
    const files = await import("fs").then((fs) =>
      fs.readdirSync(attachmentsDir),
    );
    // Six image files should have been copied
    assert.strictEqual(files.length, 6);
  });

  test("tags from imported documents appear in client.tags.all()", async () => {
    const tags = await client.tags.all();
    assert.ok(tags.includes("review"));
  });
});

// ---------------------------------------------------------------------------
// Generic (Other) markdown import suite
// ---------------------------------------------------------------------------

describe("Generic markdown import", () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  let notesDir: string;
  let fixtureDir: string;

  before(async () => {
    notesDir = mkdtempSync(path.join(tmpdir(), "chronicles-other-test-"));
    client = await createClient({ dbPath: ":memory:", notesDir });
    await client.preferences.set("notesDir", notesDir);

    fixtureDir = prepareFixtureDir();
    const otherImportDir = path.join(fixtureDir, "other");
    await client.importer.import(otherImportDir, SourceType.Other);
  });

  after(() => {
    rmSync(notesDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  test("imports two notes", async () => {
    const importedNotes = await client.db.select().from(schema.importNotes);
    assert.strictEqual(importedNotes.length, 2);
    for (const note of importedNotes) {
      assert.strictEqual(note.status, "note_created");
    }
  });

  test("Document 1 has correct frontmatter", async () => {
    const result = await client.documents.search({ titles: ["Document 1"] });
    assert.strictEqual(result.data.length, 1);
    const doc = await client.documents.findById({ id: result.data[0].id });

    // Partial match: check each expected property
    assert.strictEqual(doc.frontMatter.title, "Document 1");
    assert.deepStrictEqual(doc.frontMatter.tags, ["devlog"]);
    assert.strictEqual(doc.frontMatter.createdAt, "2024-11-08T14:17:11.337Z");
    assert.strictEqual(doc.frontMatter.updatedAt, "2024-11-23T19:45:56.621Z");
  });

  test("Document 2 has correct frontmatter including inline tag", async () => {
    const result = await client.documents.search({ titles: ["Document 2"] });
    assert.strictEqual(result.data.length, 1);
    const doc = await client.documents.findById({ id: result.data[0].id });

    assert.strictEqual(doc.frontMatter.title, "Document 2");
    assert.strictEqual(doc.frontMatter.createdAt, "2024-11-09T14:46:36.190Z");
    assert.strictEqual(doc.frontMatter.updatedAt, "2024-11-22T17:13:39.227Z");

    // "devlog" and "chronicles" from frontmatter, "customtag" from inline #customtag
    assert.ok(doc.frontMatter.tags.includes("devlog"));
    assert.ok(doc.frontMatter.tags.includes("chronicles"));
    assert.ok(doc.frontMatter.tags.includes("customtag"));
  });

  test("Document 1 journal is inferred from folder name", async () => {
    const result = await client.documents.search({ titles: ["Document 1"] });
    assert.strictEqual(result.data[0].journal, "chronicles");
  });

  test("wikilink [[Document 2]] in Document 1 is converted to markdown link", async () => {
    const doc1Search = await client.documents.search({
      titles: ["Document 1"],
    });
    const doc2Search = await client.documents.search({
      titles: ["Document 2"],
    });

    const doc1 = await client.documents.findById({ id: doc1Search.data[0].id });
    const doc2Id = doc2Search.data[0].id;

    // Wikilink should be converted to a chronicles relative markdown link
    assert.ok(doc1.content.includes(`../chronicles/${doc2Id}.md`));
  });

  test("wikilink [[Document 1]] in Document 2 is converted to markdown link", async () => {
    const doc1Search = await client.documents.search({
      titles: ["Document 1"],
    });
    const doc2Search = await client.documents.search({
      titles: ["Document 2"],
    });

    const doc2 = await client.documents.findById({ id: doc2Search.data[0].id });
    const doc1Id = doc1Search.data[0].id;

    assert.ok(doc2.content.includes(`../chronicles/${doc1Id}.md`));
  });

  test("tags from imported documents appear in client.tags.all()", async () => {
    const tags = await client.tags.all();
    assert.ok(tags.includes("devlog"));
    assert.ok(tags.includes("chronicles"));
    assert.ok(tags.includes("customtag"));
  });
});

// ---------------------------------------------------------------------------
// Error-handling and table management
// ---------------------------------------------------------------------------

describe("import error handling and table management", () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  let notesDir: string;
  let fixtureDir: string;

  before(async () => {
    notesDir = mkdtempSync(path.join(tmpdir(), "chronicles-mgmt-test-"));
    client = await createClient({ dbPath: ":memory:", notesDir });
    await client.preferences.set("notesDir", notesDir);
    fixtureDir = prepareFixtureDir();
  });

  after(() => {
    rmSync(notesDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  test("import throws when importDir is inside notesDir", async () => {
    const nestedDir = path.join(notesDir, "some-subfolder");
    await assert.rejects(
      client.importer.import(nestedDir, SourceType.Other),
      /chronicles root directory/,
    );
  });

  test("clearImportTables() removes all import records", async () => {
    const otherDir = path.join(fixtureDir, "other");
    await client.importer.import(otherDir, SourceType.Other);

    const notesBefore = await client.db.select().from(schema.importNotes);
    assert.ok(notesBefore.length > 0);

    await client.importer.clearImportTables();

    const notesAfter = await client.db.select().from(schema.importNotes);
    const filesAfter = await client.db.select().from(schema.importFiles);
    const importsAfter = await client.db.select().from(schema.imports);

    assert.strictEqual(notesAfter.length, 0);
    assert.strictEqual(filesAfter.length, 0);
    assert.strictEqual(importsAfter.length, 0);
  });

  test("clearIncomplete() only removes non-completed notes", async () => {
    // Insert a mix of completed and non-completed rows directly via the DB
    const importerId = "test-importer-id";
    await client.db.insert(schema.imports).values({
      id: importerId,
      importDir: "/some/fake/dir",
      status: "pending",
    });
    await client.db.insert(schema.importNotes).values([
      {
        importerId,
        sourcePath: "/fake/note1.md",
        chroniclesId: "id-completed",
        chroniclesPath: "journal/id-completed.md",
        journal: "journal",
        frontMatter: "{}",
        content: "content",
        status: "note_created",
      },
      {
        importerId,
        sourcePath: "/fake/note2.md",
        chroniclesId: "id-pending",
        chroniclesPath: "journal/id-pending.md",
        journal: "journal",
        frontMatter: "{}",
        content: "content",
        status: "pending",
      },
      {
        importerId,
        sourcePath: "/fake/note3.md",
        chroniclesId: "id-error",
        chroniclesPath: "staging_error",
        journal: "staging_error",
        frontMatter: "{}",
        content: "content",
        status: "staging_error",
      },
    ]);

    await client.importer.clearIncomplete();

    const remaining = await client.db.select().from(schema.importNotes);
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].status, "note_created");
    assert.strictEqual(remaining[0].chroniclesId, "id-completed");
  });
});

// ---------------------------------------------------------------------------
// Sequential import (Notion then Other, like the original electron tests)
// ---------------------------------------------------------------------------

describe("sequential Notion then Other import", () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  let notesDir: string;
  let fixtureDir: string;

  before(async () => {
    notesDir = mkdtempSync(path.join(tmpdir(), "chronicles-seq-test-"));
    client = await createClient({ dbPath: ":memory:", notesDir });
    await client.preferences.set("notesDir", notesDir);
    fixtureDir = prepareFixtureDir();

    // Import Notion first
    await client.importer.import(
      path.join(fixtureDir, "notion"),
      SourceType.Notion,
    );
    // Then import Other
    await client.importer.import(
      path.join(fixtureDir, "other"),
      SourceType.Other,
    );
  });

  after(() => {
    rmSync(notesDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  test("four notes total after both imports", async () => {
    const notes = await client.db.select().from(schema.importNotes);
    assert.strictEqual(notes.length, 4);
    for (const note of notes) {
      assert.strictEqual(note.status, "note_created");
    }
  });

  test("six files total (only from Notion; Other has no attachments)", async () => {
    const files = await client.db.select().from(schema.importFiles);
    assert.strictEqual(files.length, 6);
  });

  test("all four documents are searchable", async () => {
    const result = await client.documents.search({});
    assert.strictEqual(result.data.length, 4);
  });

  test("tags from both imports appear in tags.all()", async () => {
    const tags = await client.tags.all();
    assert.ok(tags.includes("review")); // from Notion Portland Drive
    assert.ok(tags.includes("devlog")); // from Other documents
    assert.ok(tags.includes("customtag")); // from inline #customtag in Document 2
  });
});
