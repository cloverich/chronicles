import crypto from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { createClient } from "./factory";
import * as schema from "./schema";

const scratch = fs.mkdtempSync(path.join(tmpdir(), "chronicles-attachments-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const sha = (b: Buffer | string) =>
  crypto.createHash("sha256").update(b).digest("hex");
const ref = (b: string, ext: string) =>
  `chronicles://attachment/${sha(b)}${ext}`;

describe("AttachmentStore.putBytes", () => {
  test("stores by content hash, dedupes, records metadata", async () => {
    const notesDir = path.join(scratch, "put");
    const client = await createClient({ dbPath: ":memory:", notesDir });
    const a = await client.files.attachments.putBytes(Buffer.from("hello"), {
      ext: ".TXT",
      originalName: "Hello.TXT",
    });
    const b = await client.files.attachments.putBytes(Buffer.from("hello"), {
      ext: ".txt",
    });

    assert.strictEqual(a.url, ref("hello", ".txt"));
    assert.strictEqual(a.existed, false);
    assert.strictEqual(b.existed, true);
    const file = path.join(
      notesDir,
      "_attachments",
      sha("hello").slice(0, 2),
      `${sha("hello")}.txt`,
    );
    assert.strictEqual(fs.readFileSync(file, "utf8"), "hello");

    const rows = await client.db.select().from(schema.attachments);
    assert.deepStrictEqual(
      rows.map(({ createdAt, ...r }) => r),
      [
        {
          sha256: sha("hello"),
          ext: ".txt",
          mime: "text/plain",
          byteSize: 5,
          originalName: "Hello.TXT",
        },
      ],
    );
  });
});

describe("AttachmentStore.migrateLegacyLayout", () => {
  async function legacyLibrary(name: string) {
    const notesDir = path.join(scratch, name);
    const client = await createClient({ dbPath: ":memory:", notesDir });
    await client.journals.create({ name: "work" });
    const legacy = path.join(notesDir, "_attachments");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "png-bytes");
    fs.writeFileSync(path.join(legacy, "sp ace.txt"), "text-bytes");
    fs.writeFileSync(path.join(legacy, "dup.png"), "png-bytes");
    fs.writeFileSync(path.join(legacy, ".DS_Store"), "ignored");

    const content = [
      "![a](../_attachments/a.png)",
      "![a again](chronicles://../_attachments/a.png)",
      "[text](../_attachments/sp%20ace.txt)",
      "![dup](../_attachments/dup.png)",
      "![gone](../_attachments/missing.png)",
      "`![code](../_attachments/a.png)`",
      "",
    ].join("\n\n");
    const id = await client.documents.createDocument({
      journal: "work",
      content,
      frontMatter: {
        tags: [],
        title: "Legacy",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });
    return { client, notesDir, id, content };
  }

  test("moves flat files into the pool and rewrites references", async () => {
    const { client, notesDir, id, content } = await legacyLibrary("legacy");
    const result = await client.files.attachments.migrateLegacyLayout();
    assert.deepStrictEqual(result, { files: 3, notesUpdated: 1 });

    const doc = await client.documents.findById({ id });
    const png = ref("png-bytes", ".png");
    assert.strictEqual(
      doc.content,
      content
        .replace("(../_attachments/a.png)", `(${png})`)
        .replace("(chronicles://../_attachments/a.png)", `(${png})`)
        .replace(
          "(../_attachments/sp%20ace.txt)",
          `(${ref("text-bytes", ".txt")})`,
        )
        .replace("(../_attachments/dup.png)", `(${png})`),
    );

    const remaining = fs
      .readdirSync(path.join(notesDir, "_attachments"))
      .sort();
    assert.deepStrictEqual(
      remaining,
      [
        ".DS_Store",
        sha("png-bytes").slice(0, 2),
        sha("text-bytes").slice(0, 2),
      ].sort(),
    );

    const images = await client.db
      .select({ imagePath: schema.imageLinks.imagePath })
      .from(schema.imageLinks)
      .where(eq(schema.imageLinks.documentId, id));
    assert.deepStrictEqual(images.map((r) => r.imagePath).sort(), [
      "../_attachments/missing.png",
      png,
    ]);

    // Re-running is a no-op.
    assert.deepStrictEqual(
      await client.files.attachments.migrateLegacyLayout(),
      { files: 0, notesUpdated: 0 },
    );
  });

  test("a crash after the rewrite commits only leaves files to clean up", async () => {
    const { client, notesDir, id } = await legacyLibrary("crash");
    await client.files.attachments.migrateLegacyLayout();
    const migrated = (await client.documents.findById({ id })).content;

    // Simulate originals surviving a crash between commit and deletion.
    fs.writeFileSync(path.join(notesDir, "_attachments", "a.png"), "png-bytes");
    const result = await client.files.attachments.migrateLegacyLayout();
    assert.deepStrictEqual(result, { files: 1, notesUpdated: 0 });
    assert.strictEqual(
      (await client.documents.findById({ id })).content,
      migrated,
    );
    assert.ok(!fs.existsSync(path.join(notesDir, "_attachments", "a.png")));
  });

  test("runs at startup", async () => {
    const notesDir = path.join(scratch, "startup");
    const dbPath = path.join(scratch, "startup.db");
    const first = await createClient({ dbPath, notesDir });
    await first.journals.create({ name: "work" });
    const id = await first.documents.createDocument({
      journal: "work",
      content: "![a](../_attachments/a.png)\n",
      frontMatter: {
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });
    first.sqlite.close();
    fs.mkdirSync(path.join(notesDir, "_attachments"), { recursive: true });
    fs.writeFileSync(path.join(notesDir, "_attachments", "a.png"), "png-bytes");

    const second = await createClient({ dbPath, notesDir });
    const doc = await second.documents.findById({ id });
    assert.strictEqual(doc.content, `![a](${ref("png-bytes", ".png")})\n`);
  });
});
