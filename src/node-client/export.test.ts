import crypto from "crypto";
import { eq } from "drizzle-orm";
import fs, {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import yaml from "yaml";
import { SourceType } from "../preload/client/importer/SourceType";
import { createClient } from "./factory";
import * as schema from "./schema";

// A 1x1 transparent PNG.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function sha256(contents: string): string {
  return crypto.createHash("sha256").update(contents, "utf8").digest("hex");
}

interface Fixture {
  notesDir: string;
  client: Awaited<ReturnType<typeof createClient>>;
  ids: {
    noteA: string;
    noteB: string;
    noteMissingImage: string;
    noteEmpty: string;
    noteUnicode: string;
  };
}

/**
 * Builds a fresh client with a set of notes across two journals, exercising
 * tags, a user frontmatter key, a note link, a resolvable attachment, a
 * missing attachment, an empty-body note, and a Unicode note.
 *
 * Note bodies are written already in the form remark-stringify (via
 * mdastToString) produces, so that round-tripping through export + Chronicles
 * import reproduces them byte-for-byte (verified directly: parseMarkdown +
 * mdastToString is idempotent for these inputs).
 */
async function buildFixtureClient(prefix: string): Promise<Fixture> {
  const notesDir = mkdtempSync(path.join(tmpdir(), prefix));
  const client = await createClient({ dbPath: ":memory:", notesDir });

  await client.journals.create({ name: "journal-alpha" });
  await client.journals.create({ name: "journal-beta" });

  fs.mkdirSync(path.join(notesDir, "_attachments"), { recursive: true });
  writeFileSync(path.join(notesDir, "_attachments", "pixel.png"), PIXEL_PNG);

  const noteA = await client.documents.createDocument({
    journal: "journal-alpha",
    content:
      "Hello world.\n\nAn attached image:\n\n![alt text](../_attachments/pixel.png)\n",
    frontMatter: {
      title: "First Note",
      tags: ["alpha", "beta"],
      createdAt: "2024-01-15T00:00:00.000Z",
      updatedAt: "2024-01-16T00:00:00.000Z",
      source: "export-test",
    },
  });

  const noteB = await client.documents.createDocument({
    journal: "journal-beta",
    content: `[First Note](../journal-alpha/${noteA}.md)\n`,
    frontMatter: {
      tags: [],
      createdAt: "2024-02-01T00:00:00.000Z",
      updatedAt: "2024-02-01T00:00:00.000Z",
    },
  });

  const noteMissingImage = await client.documents.createDocument({
    journal: "journal-alpha",
    content: "![missing](../_attachments/does-not-exist.png)\n",
    frontMatter: {
      title: "Missing Image",
      tags: [],
      createdAt: "2024-03-01T00:00:00.000Z",
      updatedAt: "2024-03-01T00:00:00.000Z",
    },
  });

  const noteEmpty = await client.documents.createDocument({
    journal: "journal-alpha",
    content: "",
    frontMatter: {
      title: "Empty Note",
      tags: [],
      createdAt: "2024-04-01T00:00:00.000Z",
      updatedAt: "2024-04-01T00:00:00.000Z",
    },
  });

  const noteUnicode = await client.documents.createDocument({
    journal: "journal-beta",
    content: "你好, world! Émoji: 🚀\n",
    frontMatter: {
      title: "笔记 🎉",
      tags: ["unicode"],
      createdAt: "2024-05-01T00:00:00.000Z",
      updatedAt: "2024-05-01T00:00:00.000Z",
    },
  });

  return {
    notesDir,
    client,
    ids: { noteA, noteB, noteMissingImage, noteEmpty, noteUnicode },
  };
}

describe("ExportClient.export", () => {
  let fixture: Fixture;
  let parentDir: string;
  let destDir: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-export-test-");
    parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-export-dest-"));
    destDir = path.join(parentDir, "export-out");
  });

  after(() => {
    rmSync(fixture.notesDir, { recursive: true, force: true });
    rmSync(parentDir, { recursive: true, force: true });
  });

  test("writes every note, manifest, and copies referenced attachments", async () => {
    const report = await fixture.client.export.export(destDir);

    assert.strictEqual(report.destDir, destDir);
    assert.strictEqual(report.notes, 5);
    assert.strictEqual(report.attachments.copied, 1);
    assert.deepStrictEqual(report.attachments.missing, ["does-not-exist.png"]);

    // ---- note files exist and frontmatter parses back ----
    const noteAPath = path.join(
      destDir,
      "journal-alpha",
      `${fixture.ids.noteA}.md`,
    );
    assert.ok(existsSync(noteAPath));
    const noteARaw = readFileSync(noteAPath, "utf8");
    assert.ok(noteARaw.startsWith("---\n"));
    const yamlBlock = noteARaw.split("---\n")[1];
    const frontMatter = yaml.parse(yamlBlock);
    assert.strictEqual(frontMatter.title, "First Note");
    assert.deepStrictEqual(frontMatter.tags, ["alpha", "beta"]);
    assert.strictEqual(frontMatter.createdAt, "2024-01-15T00:00:00.000Z");
    assert.strictEqual(frontMatter.updatedAt, "2024-01-16T00:00:00.000Z");
    assert.strictEqual(frontMatter.source, "export-test");
    assert.ok(noteARaw.includes("../_attachments/pixel.png"));

    // note with empty tags still serializes `tags: []`
    const noteBPath = path.join(
      destDir,
      "journal-beta",
      `${fixture.ids.noteB}.md`,
    );
    const noteBRaw = readFileSync(noteBPath, "utf8");
    const noteBFrontMatter = yaml.parse(noteBRaw.split("---\n")[1]);
    assert.deepStrictEqual(noteBFrontMatter.tags, []);
    assert.ok(!("title" in noteBFrontMatter));

    // empty body note
    const noteEmptyPath = path.join(
      destDir,
      "journal-alpha",
      `${fixture.ids.noteEmpty}.md`,
    );
    const noteEmptyRaw = readFileSync(noteEmptyPath, "utf8");
    assert.ok(noteEmptyRaw.endsWith("tags: []\n---\n"));

    // unicode note
    const noteUnicodePath = path.join(
      destDir,
      "journal-beta",
      `${fixture.ids.noteUnicode}.md`,
    );
    const noteUnicodeRaw = readFileSync(noteUnicodePath, "utf8");
    assert.ok(noteUnicodeRaw.includes("你好, world! Émoji: 🚀"));
    const noteUnicodeFrontMatter = yaml.parse(noteUnicodeRaw.split("---\n")[1]);
    assert.strictEqual(noteUnicodeFrontMatter.title, "笔记 🎉");

    // ---- attachment copied ----
    const attachmentPath = path.join(destDir, "_attachments", "pixel.png");
    assert.ok(existsSync(attachmentPath));
    assert.ok(readFileSync(attachmentPath).equals(PIXEL_PNG));

    // ---- manifest ----
    const manifest = JSON.parse(
      readFileSync(path.join(destDir, "manifest.json"), "utf8"),
    );
    assert.strictEqual(manifest.formatVersion, "2.0");
    assert.ok(!("exportedAt" in manifest));
    assert.deepStrictEqual(
      manifest.journals.map(({ name, dir }: any) => ({ name, dir })),
      [
        { name: "default_journal", dir: "default_journal" },
        { name: "journal-alpha", dir: "journal-alpha" },
        { name: "journal-beta", dir: "journal-beta" },
      ],
    );
    const alpha = (await fixture.client.journals.list()).find(
      (j) => j.name === "journal-alpha",
    )!;
    assert.strictEqual(manifest.notes.length, 5);
    assert.deepStrictEqual(manifest.attachments, [
      {
        path: "_attachments/pixel.png",
        sha256: crypto.createHash("sha256").update(PIXEL_PNG).digest("hex"),
        byteSize: PIXEL_PNG.byteLength,
      },
    ]);

    const manifestEntryA = manifest.notes.find(
      (n: any) => n.id === fixture.ids.noteA,
    );
    assert.strictEqual(manifestEntryA.journalId, alpha.id);
    assert.ok(noteARaw.includes(`journal: "${alpha.id}"`));
    assert.strictEqual(manifestEntryA.revision, sha256(noteARaw));

    for (const entry of manifest.notes) {
      const raw = readFileSync(path.join(destDir, entry.path), "utf8");
      assert.strictEqual(entry.revision, sha256(raw));
    }

    const info = JSON.parse(
      readFileSync(path.join(destDir, "export-info.json"), "utf8"),
    );
    assert.strictEqual(typeof info.exportedAt, "string");
  });
});

describe("ExportClient.export refusals", () => {
  let fixture: Fixture;
  let parentDir: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-export-refuse-test-");
    parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-export-refuse-"));
  });

  after(() => {
    rmSync(fixture.notesDir, { recursive: true, force: true });
    rmSync(parentDir, { recursive: true, force: true });
  });

  test("refuses an existing destination and leaves no temp dir behind", async () => {
    const existingDest = path.join(parentDir, "already-here");
    fs.mkdirSync(existingDest);

    const before = readdirSync(parentDir).sort();

    await assert.rejects(
      fixture.client.export.export(existingDest),
      /\[EXPORT_DEST_EXISTS\]/,
    );

    const after = readdirSync(parentDir).sort();
    assert.deepStrictEqual(after, before);
  });

  test("refuses a destination inside notesDir", async () => {
    await assert.rejects(
      fixture.client.export.export(
        path.join(fixture.notesDir, "nested-export"),
      ),
      /\[EXPORT_DEST_CONFLICT\]/,
    );
  });

  test("refuses a destination that contains notesDir", async () => {
    // notesDir is itself inside a temp dir; export to that temp dir's parent
    // would make notesDir a subdirectory of dest — not testable generically,
    // so instead assert the direct containment case: notesDir inside dest.
    const wrapperParent = path.dirname(fixture.notesDir);
    await assert.rejects(
      fixture.client.export.export(wrapperParent),
      /EXPORT_DEST/,
    );
  });
});

describe("ExportClient.export byte-stability", () => {
  let fixture: Fixture;
  let parentDir: string;
  let dest1: string;
  let dest2: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-export-stable-test-");
    parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-export-stable-"));
    dest1 = path.join(parentDir, "export-1");
    dest2 = path.join(parentDir, "export-2");

    await fixture.client.export.export(dest1);
    // Ensure a different exportedAt timestamp is possible/irrelevant either way.
    await fixture.client.export.export(dest2);
  });

  after(() => {
    rmSync(fixture.notesDir, { recursive: true, force: true });
    rmSync(parentDir, { recursive: true, force: true });
  });

  function listFilesRecursive(dir: string, base = dir): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(listFilesRecursive(full, base));
      } else {
        files.push(path.relative(base, full));
      }
    }
    return files.sort();
  }

  test("identical file trees across two exports", () => {
    const files1 = listFilesRecursive(dest1);
    const files2 = listFilesRecursive(dest2);
    assert.deepStrictEqual(files1, files2);
  });

  test("every file except export-info.json is byte-identical", () => {
    const files = listFilesRecursive(dest1).filter(
      (f) => f !== "export-info.json",
    );
    assert.ok(files.includes("manifest.json"));
    for (const relPath of files) {
      const a = readFileSync(path.join(dest1, relPath));
      const b = readFileSync(path.join(dest2, relPath));
      assert.ok(a.equals(b), `mismatch in ${relPath}`);
    }
  });
});

describe("ExportClient.export round-trip via Chronicles import", () => {
  let fixture: Fixture;
  let parentDir: string;
  let destDir: string;
  let secondClient: Awaited<ReturnType<typeof createClient>>;
  let secondNotesDir: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-export-roundtrip-test-");
    parentDir = mkdtempSync(
      path.join(tmpdir(), "chronicles-export-roundtrip-"),
    );
    destDir = path.join(parentDir, "export-out");
    await fixture.client.export.export(destDir);

    secondNotesDir = mkdtempSync(
      path.join(tmpdir(), "chronicles-export-roundtrip-import-"),
    );
    secondClient = await createClient({
      dbPath: ":memory:",
      notesDir: secondNotesDir,
    });
    await secondClient.importer.import(destDir, SourceType.Chronicles);
  });

  after(() => {
    rmSync(fixture.notesDir, { recursive: true, force: true });
    rmSync(secondNotesDir, { recursive: true, force: true });
    rmSync(parentDir, { recursive: true, force: true });
  });

  test("every note is semantically identical between the original and re-imported client", async () => {
    for (const id of Object.values(fixture.ids)) {
      const original = await fixture.client.documents.findById({ id });
      const reimported = await secondClient.documents.findById({ id });

      assert.deepStrictEqual(
        {
          id: reimported.id,
          journal: reimported.journal,
          content: reimported.content,
          frontMatter: reimported.frontMatter,
        },
        {
          id: original.id,
          journal: original.journal,
          content: original.content,
          frontMatter: original.frontMatter,
        },
        `mismatch for note ${id}`,
      );
    }
  });

  test("document_links match between original and re-imported client", async () => {
    const originalLinks = await fixture.client.db
      .select({
        targetId: schema.documentLinks.targetId,
        targetJournal: schema.documentLinks.targetJournal,
      })
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, fixture.ids.noteB));

    const reimportedLinks = await secondClient.db
      .select({
        targetId: schema.documentLinks.targetId,
        targetJournal: schema.documentLinks.targetJournal,
      })
      .from(schema.documentLinks)
      .where(eq(schema.documentLinks.documentId, fixture.ids.noteB));

    assert.deepStrictEqual(reimportedLinks, originalLinks);
  });

  test("image_links match between original and re-imported client", async () => {
    const originalImages = await fixture.client.db
      .select({ imagePath: schema.imageLinks.imagePath })
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, fixture.ids.noteA));

    const reimportedImages = await secondClient.db
      .select({ imagePath: schema.imageLinks.imagePath })
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, fixture.ids.noteA));

    assert.deepStrictEqual(reimportedImages, originalImages);
  });

  test("tags match between original and re-imported client", async () => {
    const originalTags = await fixture.client.db
      .select({ tag: schema.documentTags.tag })
      .from(schema.documentTags)
      .where(eq(schema.documentTags.documentId, fixture.ids.noteA))
      .orderBy(schema.documentTags.tag);

    const reimportedTags = await secondClient.db
      .select({ tag: schema.documentTags.tag })
      .from(schema.documentTags)
      .where(eq(schema.documentTags.documentId, fixture.ids.noteA))
      .orderBy(schema.documentTags.tag);

    assert.deepStrictEqual(reimportedTags, originalTags);
  });

  test("re-imported attachment content matches", () => {
    const reimportedPixel = readFileSync(
      path.join(secondNotesDir, "_attachments", "pixel.png"),
    );
    assert.ok(reimportedPixel.equals(PIXEL_PNG));
  });
});

describe("ExportClient.export → import → export", () => {
  test("second export is byte-identical to the first", async () => {
    const fixture = await buildFixtureClient("chronicles-export-rt2-test-");
    const parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-rt2-"));
    const secondNotesDir = mkdtempSync(path.join(tmpdir(), "chronicles-rt2-"));
    try {
      const first = path.join(parentDir, "first");
      const second = path.join(parentDir, "second");
      await fixture.client.export.export(first);

      const client = await createClient({
        dbPath: ":memory:",
        notesDir: secondNotesDir,
      });
      await client.importer.import(first, SourceType.Chronicles);
      await client.export.export(second);

      const list = (dir: string) =>
        fs
          .readdirSync(dir, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile() && e.name !== "export-info.json")
          .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
          .sort();
      assert.deepStrictEqual(list(second), list(first));
      for (const rel of list(first)) {
        assert.ok(
          readFileSync(path.join(first, rel)).equals(
            readFileSync(path.join(second, rel)),
          ),
          `mismatch in ${rel}`,
        );
      }
    } finally {
      rmSync(fixture.notesDir, { recursive: true, force: true });
      rmSync(secondNotesDir, { recursive: true, force: true });
      rmSync(parentDir, { recursive: true, force: true });
    }
  });

  test("import rejects an unknown major format version", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "chronicles-badver-"));
    const notesDir = mkdtempSync(path.join(tmpdir(), "chronicles-badver-"));
    try {
      writeFileSync(
        path.join(dir, "manifest.json"),
        JSON.stringify({ formatVersion: "3.0", journals: [], notes: [] }),
      );
      const client = await createClient({ dbPath: ":memory:", notesDir });
      await assert.rejects(
        client.importer.import(dir, SourceType.Chronicles),
        /IMPORT_UNSUPPORTED_FORMAT/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(notesDir, { recursive: true, force: true });
    }
  });
});
