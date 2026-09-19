import Database from "better-sqlite3";
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
import { createClient } from "./factory";

// A 1x1 transparent PNG.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface Fixture {
  notesDir: string;
  dbPath: string;
  client: Awaited<ReturnType<typeof createClient>>;
  noteAId: string;
}

async function buildFixtureClient(prefix: string): Promise<Fixture> {
  const notesDir = mkdtempSync(path.join(tmpdir(), prefix));
  const dbPath = path.join(notesDir, "chronicles.db");
  const client = await createClient({ dbPath, notesDir });

  await client.journals.create({ name: "journal-alpha" });

  fs.mkdirSync(path.join(notesDir, "_attachments"), { recursive: true });
  writeFileSync(path.join(notesDir, "_attachments", "pixel.png"), PIXEL_PNG);
  // An unreferenced attachment — backup copies the whole directory,
  // unlike export which only copies referenced files.
  writeFileSync(
    path.join(notesDir, "_attachments", "unreferenced.png"),
    PIXEL_PNG,
  );

  const noteAId = await client.documents.createDocument({
    journal: "journal-alpha",
    content: "Hello world.\n",
    frontMatter: {
      title: "First Note",
      tags: ["alpha"],
      createdAt: "2024-01-15T00:00:00.000Z",
      updatedAt: "2024-01-16T00:00:00.000Z",
    },
  });

  await client.documents.createDocument({
    journal: "journal-alpha",
    content: "Second note.\n",
    frontMatter: {
      title: "Second Note",
      tags: [],
      createdAt: "2024-01-17T00:00:00.000Z",
      updatedAt: "2024-01-17T00:00:00.000Z",
    },
  });

  return { notesDir, dbPath, client, noteAId };
}

function documentCount(dbPath: string): {
  count: number;
  titles: string[];
} {
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare("SELECT title FROM documents ORDER BY title")
      .all() as { title: string }[];
    return { count: rows.length, titles: rows.map((r) => r.title) };
  } finally {
    db.close();
  }
}

describe("BackupClient.backup", () => {
  let fixture: Fixture;
  let parentDir: string;
  let destDir: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-backup-test-");
    parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-backup-dest-"));
    destDir = path.join(parentDir, "backup-out");
  });

  after(() => {
    rmSync(fixture.notesDir, { recursive: true, force: true });
    rmSync(parentDir, { recursive: true, force: true });
  });

  test("writes the database, all attachments, and a manifest", async () => {
    const report = await fixture.client.backup.backup(destDir);

    assert.strictEqual(report.destDir, destDir);
    assert.ok(report.databaseBytes > 0);
    assert.strictEqual(report.attachments.files, 2);
    assert.ok(report.attachments.bytes > 0);

    // ---- database ----
    const dbDestPath = path.join(destDir, "chronicles.db");
    assert.ok(existsSync(dbDestPath));

    const { count, titles } = documentCount(dbDestPath);
    assert.strictEqual(count, 2);
    assert.deepStrictEqual(titles, ["First Note", "Second Note"]);

    // ---- attachments, including unreferenced file ----
    const attachmentsDir = path.join(destDir, "_attachments");
    assert.ok(
      readFileSync(path.join(attachmentsDir, "pixel.png")).equals(PIXEL_PNG),
    );
    assert.ok(
      readFileSync(path.join(attachmentsDir, "unreferenced.png")).equals(
        PIXEL_PNG,
      ),
    );

    // ---- manifest ----
    const manifest = JSON.parse(
      readFileSync(path.join(destDir, "backup.json"), "utf8"),
    );
    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(typeof manifest.backedUpAt, "string");
    assert.strictEqual(manifest.database, "chronicles.db");
    assert.strictEqual(manifest.attachments, "_attachments");
  });

  test("the live database still works after backup", async () => {
    const id = await fixture.client.documents.createDocument({
      journal: "journal-alpha",
      content: "After backup.\n",
      frontMatter: {
        title: "After Backup",
        tags: [],
        createdAt: "2024-01-18T00:00:00.000Z",
        updatedAt: "2024-01-18T00:00:00.000Z",
      },
    });

    const doc = await fixture.client.documents.findById({ id });
    assert.strictEqual(doc.content, "After backup.\n");
  });
});

describe("BackupClient.backup refusals", () => {
  let fixture: Fixture;
  let parentDir: string;

  before(async () => {
    fixture = await buildFixtureClient("chronicles-backup-refuse-test-");
    parentDir = mkdtempSync(path.join(tmpdir(), "chronicles-backup-refuse-"));
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
      fixture.client.backup.backup(existingDest),
      /\[BACKUP_DEST_EXISTS\]/,
    );

    const after = readdirSync(parentDir).sort();
    assert.deepStrictEqual(after, before);
  });

  test("refuses a destination inside notesDir", async () => {
    await assert.rejects(
      fixture.client.backup.backup(
        path.join(fixture.notesDir, "nested-backup"),
      ),
      /\[BACKUP_DEST_CONFLICT\]/,
    );
  });

  test("refuses a destination that contains notesDir", async () => {
    const wrapperParent = path.dirname(fixture.notesDir);
    await assert.rejects(
      fixture.client.backup.backup(wrapperParent),
      /BACKUP_DEST/,
    );
  });
});
