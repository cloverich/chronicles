import fs, { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createId } from "../preload/client/util";
import { createClient } from "./factory";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;
let settingsDir: string;

function writeDoc(
  journal: string,
  id: string,
  opts: { title?: string; tags?: string[]; content?: string } = {},
) {
  const journalDir = path.join(notesDir, journal);
  fs.mkdirSync(journalDir, { recursive: true });
  const title = opts.title || "Untitled";
  const tags = opts.tags || [];
  const content = opts.content || "Some content";
  const md = `---
title: ${title}
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
createdAt: "2024-01-15T00:00:00.000Z"
updatedAt: "2024-01-15T00:00:00.000Z"
---

${content}
`;
  fs.writeFileSync(path.join(journalDir, `${id}.md`), md);
}

/** Generate a valid uuid25-style ID (padded base36 of a v1-like timestamp). */
function makeId(n: number): string {
  return createId(1700000000000 + n * 1000);
}

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-indexer-test-");
  settingsDir = mkdtempSync(tmpdir() + "/chronicles-indexer-settings-");
  client = await createClient({
    dbPath: ":memory:",
    notesDir,
    settingsDir,
  });

  // Set notesDir preference (indexer reads it)
  await client.preferences.set("notesDir", notesDir);
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
  rmSync(settingsDir, { recursive: true, force: true });
});

describe("indexer — basic indexing", () => {
  const id1 = makeId(1);
  const id2 = makeId(2);

  test("indexes markdown files from a journal directory", async () => {
    writeDoc("journal-one", id1, {
      title: "First Doc",
      tags: ["alpha"],
      content: "Hello from the first document",
    });
    writeDoc("journal-one", id2, {
      title: "Second Doc",
      tags: ["beta"],
      content: "Hello from the second document",
    });

    await client.indexer.index(true);

    // Both docs should be searchable
    const res = await client.documents.search({});
    const ids = res.data.map((d) => d.id);
    assert.ok(ids.includes(id1));
    assert.ok(ids.includes(id2));
  });

  test("journal is created from directory name", async () => {
    const journals = await client.journals.list();
    const names = journals.map((j) => j.name);
    assert.ok(names.includes("journal-one"));
  });

  test("FTS is populated during index", async () => {
    const res = await client.documents.search({ texts: ["first"] });
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, id1);
  });

  test("tags are indexed", async () => {
    const res = await client.documents.search({ tags: ["alpha"] });
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, id1);
  });
});

describe("indexer — incremental sync", () => {
  const id3 = makeId(3);

  test("unchanged files are skipped on re-index", async () => {
    // Index once — should pick up existing files
    await client.indexer.index(false);

    // Verify docs still exist (not deleted)
    const res = await client.documents.search({});
    assert.ok(res.data.length >= 2);
  });

  test("new files are picked up on incremental index", async () => {
    writeDoc("journal-one", id3, {
      title: "Third Doc",
      content: "Brand new content about elephants",
    });

    await client.indexer.index(false);

    const res = await client.documents.search({ texts: ["elephants"] });
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, id3);
  });

  test("modified file is re-indexed", async () => {
    // Overwrite id3 with different content
    // Need a small delay so mtime changes
    await new Promise((r) => setTimeout(r, 50));
    writeDoc("journal-one", id3, {
      title: "Third Doc Updated",
      content: "Completely different content about giraffes",
    });

    await client.indexer.index(false);

    // Old term should not match
    const res1 = await client.documents.search({ texts: ["elephants"] });
    assert.ok(!res1.data.some((d) => d.id === id3));

    // New term should match
    const res2 = await client.documents.search({ texts: ["giraffes"] });
    assert.ok(res2.data.some((d) => d.id === id3));
  });
});

describe("indexer — deletion and cleanup", () => {
  test("deleted file is removed from DB on next index", async () => {
    const id4 = makeId(4);
    writeDoc("journal-one", id4, {
      title: "To Delete",
      content: "This will be removed from disk",
    });

    await client.indexer.index(true);

    // Verify it exists
    let res = await client.documents.search({ texts: ["removed"] });
    assert.ok(res.data.some((d) => d.id === id4));

    // Delete from disk
    fs.unlinkSync(path.join(notesDir, "journal-one", `${id4}.md`));

    // Re-index — orphan cleanup should remove it
    await client.indexer.index(true);

    res = await client.documents.search({ texts: ["removed"] });
    assert.ok(!res.data.some((d) => d.id === id4));
  });

  test("empty journal directory is cleaned up", async () => {
    // Create a journal with one doc, index, delete doc, re-index
    const id5 = makeId(5);
    writeDoc("temp-journal", id5, {
      title: "Temp",
      content: "Temporary content",
    });

    await client.indexer.index(true);
    let journals = await client.journals.list();
    assert.ok(journals.map((j) => j.name).includes("temp-journal"));

    // Remove the journal directory entirely
    rmSync(path.join(notesDir, "temp-journal"), {
      recursive: true,
      force: true,
    });

    await client.indexer.index(true);

    journals = await client.journals.list();
    assert.ok(!journals.map((j) => j.name).includes("temp-journal"));
  });
});

describe("indexer — multiple journals", () => {
  test("indexes files across multiple journal directories", async () => {
    const idA = makeId(10);
    const idB = makeId(11);
    writeDoc("work-journal", idA, {
      title: "Work Note",
      content: "Meeting notes about quarterly review",
    });
    writeDoc("personal-journal", idB, {
      title: "Personal Note",
      content: "Grocery list for the weekend",
    });

    await client.indexer.index(true);

    const resWork = await client.documents.search({
      journals: ["work-journal"],
    });
    assert.ok(resWork.data.some((d) => d.id === idA));

    const resPersonal = await client.documents.search({
      journals: ["personal-journal"],
    });
    assert.ok(resPersonal.data.some((d) => d.id === idB));
  });
});
