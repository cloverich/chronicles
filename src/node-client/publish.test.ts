import fs from "fs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import type { PublishTarget } from "../markdown/publishProjection";
import { createClient } from "./factory";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const TARGET: PublishTarget = { kind: "hugo-bundle", frontMatter: ["tags"] };

describe("PublishClient", () => {
  let work: string;
  let root: string;
  let client: Awaited<ReturnType<typeof createClient>>;

  beforeEach(async () => {
    work = fs.mkdtempSync(path.join(tmpdir(), "chronicles-publish-"));
    root = path.join(work, "blog");
    fs.mkdirSync(root);
    client = await createClient({
      dbPath: ":memory:",
      notesDir: path.join(work, "notes"),
    });
    await client.journals.create({ name: "pinecoder" });
  });

  afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

  async function note(frontMatter: Record<string, unknown>, content = "Hi.\n") {
    return client.documents.createDocument({
      journal: "pinecoder",
      content,
      frontMatter: {
        title: "First post",
        tags: [],
        createdAt: "2026-10-14T18:30:00.000Z",
        updatedAt: "2026-10-14T18:30:00.000Z",
        ...frontMatter,
      },
    });
  }

  async function edit(id: string, frontMatter: Record<string, unknown>) {
    const doc = await client.documents.findById({ id });
    await client.documents.updateDocument({
      id,
      journal: doc.journal,
      content: doc.content,
      frontMatter: { ...doc.frontMatter, ...frontMatter },
    });
  }

  test("draft, then published, then edited", async () => {
    const id = await note({ slug: "first" });
    assert.equal(
      (await client.publish.status(id, root, TARGET)).state,
      "draft",
    );

    const result = await client.publish.publish(id, root, TARGET);
    assert.deepEqual(result, {
      state: "published",
      path: "2026-10-14/first",
      url: "/blog/2026-10-14/first/",
    });
    assert.ok(fs.existsSync(path.join(root, "2026-10-14/first/index.md")));
    assert.equal(
      (await client.publish.status(id, root, TARGET)).state,
      "published",
    );

    await edit(id, { title: "First post, edited" });
    assert.equal(
      (await client.publish.status(id, root, TARGET)).state,
      "edited",
    );
  });

  test("overview lists the journal, moved posts, and orphans", async () => {
    const draft = await note({ slug: "draft" });
    const moved = await note({ slug: "moved" });
    await client.publish.publish(moved, root, TARGET);
    await client.journals.create({ name: "private" });
    const doc = await client.documents.findById({ id: moved });
    await client.documents.updateDocument({
      id: moved,
      journal: "private",
      content: doc.content,
      frontMatter: doc.frontMatter,
    });
    fs.mkdirSync(path.join(root, "2026-01-01/gone"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "2026-01-01/gone/index.md"),
      '---\ntitle: "Gone"\nchronicles: {"id":"gone","revision":"r"}\n---\n',
    );

    const rows = await client.publish.overview("Pinecoder", root, TARGET);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.equal(byId[draft].state, "draft");
    assert.equal(byId[moved].journal, "private");
    assert.equal(byId[moved].url, "/blog/2026-10-14/moved/");
    assert.deepEqual(rows.at(-1), {
      id: "gone",
      state: "orphaned",
      path: "2026-01-01/gone",
      url: "/blog/2026-01-01/gone/",
    });
  });

  test("a changed slug moves the bundle", async () => {
    const id = await note({ slug: "old" });
    await client.publish.publish(id, root, TARGET);
    await edit(id, { slug: "new", date: "2026-10-20T00:00:00.000Z" });
    await client.publish.publish(id, root, TARGET);

    assert.ok(fs.existsSync(path.join(root, "2026-10-20/new/index.md")));
    assert.ok(!fs.existsSync(path.join(root, "2026-10-14")));
  });

  test("refuses a path held by another post", async () => {
    fs.mkdirSync(path.join(root, "2026-10-14/taken"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "2026-10-14/taken/index.md"),
      "---\ntitle: Hand written\n---\n",
    );
    const id = await note({ slug: "taken" });
    await assert.rejects(
      client.publish.publish(id, root, TARGET),
      /PUBLISH_PATH_TAKEN/,
    );
  });

  test("keeps images the site resized", async () => {
    const { sha256, ext } = await client.files.attachments.putBytes(PIXEL_PNG, {
      ext: ".png",
    });
    const id = await note(
      { slug: "pic" },
      `![p](chronicles://attachment/${sha256}${ext})\n`,
    );
    await client.publish.publish(id, root, TARGET);
    const asset = path.join(root, "2026-10-14/pic/assets", `${sha256}${ext}`);
    fs.writeFileSync(asset, "resized");

    await edit(id, { title: "Pic, retitled" });
    await client.publish.publish(id, root, TARGET);
    assert.equal(fs.readFileSync(asset, "utf8"), "resized");
  });
});
