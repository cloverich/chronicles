import fs, { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { createId } from "../preload/client/util";
import { readChroniclesTree } from "./chronicles-tree";

let notesDir: string;

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

async function collect(rootDir: string) {
  const { notes, report } = readChroniclesTree(rootDir);
  const collected = [];
  for await (const note of notes) {
    collected.push(note);
  }
  return { notes: collected, report: report() };
}

before(() => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-tree-test-");
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("readChroniclesTree", () => {
  test("discovers notes across two journals with parsed title/tags/body", async () => {
    const id1 = makeId(1);
    const id2 = makeId(2);
    writeDoc("journal-one", id1, {
      title: "First Doc",
      tags: ["alpha"],
      content: "Hello from the first document",
    });
    writeDoc("journal-two", id2, {
      title: "Second Doc",
      tags: ["beta"],
      content: "Hello from the second document",
    });

    const { notes, report } = await collect(notesDir);

    const note1 = notes.find((n) => n.id === id1)!;
    const note2 = notes.find((n) => n.id === id2)!;

    assert.ok(note1);
    assert.strictEqual(note1.journal, "journal-one");
    assert.strictEqual(note1.frontMatter.title, "First Doc");
    assert.deepStrictEqual(note1.frontMatter.tags, ["alpha"]);

    assert.ok(note2);
    assert.strictEqual(note2.journal, "journal-two");
    assert.strictEqual(note2.frontMatter.title, "Second Doc");

    assert.ok(report.journals.includes("journal-one"));
    assert.ok(report.journals.includes("journal-two"));
  });

  test("skips files with invalid ids and skippable names/prefixes", async () => {
    const journalDir = path.join(notesDir, "skip-journal");
    fs.mkdirSync(journalDir, { recursive: true });
    fs.writeFileSync(path.join(journalDir, "not-a-valid-id.md"), "content");
    fs.writeFileSync(path.join(journalDir, ".hidden.md"), "content");
    fs.mkdirSync(path.join(journalDir, "node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(journalDir, "node_modules", `${makeId(90)}.md`),
      "content",
    );

    const validId = makeId(91);
    writeDoc("skip-journal", validId, { title: "Valid" });

    const { notes } = await collect(notesDir);
    const skipJournalNotes = notes.filter((n) => n.journal === "skip-journal");

    assert.strictEqual(skipJournalNotes.length, 1);
    assert.strictEqual(skipJournalNotes[0].id, validId);
  });

  test("duplicate id across journals yields once and is reported", async () => {
    const dupId = makeId(100);
    writeDoc("dup-journal-a", dupId, { title: "First" });
    writeDoc("dup-journal-b", dupId, { title: "Second" });

    const { notes, report } = await collect(notesDir);
    const matches = notes.filter((n) => n.id === dupId);

    assert.strictEqual(matches.length, 1);
    assert.ok(report.duplicates.has(dupId));
  });

  test("malformed file lands in errored without aborting the walk", async () => {
    const journalDir = path.join(notesDir, "malformed-journal");
    fs.mkdirSync(journalDir, { recursive: true });
    const badId = makeId(200);
    const badPath = path.join(journalDir, `${badId}.md`);
    // Frontmatter with invalid YAML — splitFrontMatter's yaml.parse throws
    fs.writeFileSync(
      badPath,
      '---\ntitle: "unterminated\ntags: [oops\n---\n\nbody\n',
    );

    const goodId = makeId(201);
    writeDoc("malformed-journal", goodId, { title: "Good" });

    const { notes, report } = await collect(notesDir);

    assert.ok(notes.some((n) => n.id === goodId));
    assert.ok(report.errored.some((e) => e.path === badPath));
  });

  test("report().journals lists discovered journals", async () => {
    writeDoc("report-journal", makeId(300), { title: "Reported" });
    const { report } = await collect(notesDir);
    assert.ok(report.journals.includes("report-journal"));
  });
});
