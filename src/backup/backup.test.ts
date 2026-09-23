import Ajv2020 from "ajv/dist/2020.js";
import Database from "better-sqlite3";
import fs from "fs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { backupQueries } from "../node-client/backup-queries";
import { createClient, NodeClient } from "../node-client/factory";
import { BackupHost, Backups, createBackups } from "./index";
import {
  bareBlobPath,
  blobExtension,
  blobPath,
  materializeAttachments,
} from "./pool";

const here = path.dirname(fileURLToPath(import.meta.url));

// A 1x1 transparent PNG.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface Fixture {
  root: string;
  dataDir: string;
  notesDir: string;
  attachmentsDir: string;
  dbPath: string;
  picked: string;
  appDir: string;
  stateFile: string;
  client: NodeClient | null;
  clock: { now: Date };
  pick: { next: string | null };
  host: BackupHost;
  backups: Backups;
}

async function fixture(): Promise<Fixture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chronicles-backups-"));
  const dataDir = path.join(root, "data");
  const notesDir = path.join(dataDir, "notes");
  const attachmentsDir = path.join(notesDir, "_attachments");
  const picked = path.join(root, "Sync Folder");
  fs.mkdirSync(attachmentsDir, { recursive: true });
  fs.mkdirSync(picked);

  const dbPath = path.join(dataDir, "chronicles.db");
  const client = await createClient({ dbPath, notesDir });
  await client.journals.create({ name: "alpha" });
  await client.documents.createDocument({
    journal: "alpha",
    content: "Hello #greeting\n",
    frontMatter: {
      title: "First",
      tags: ["greeting"],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  });
  fs.writeFileSync(path.join(attachmentsDir, "pixel.png"), PIXEL);
  fs.writeFileSync(path.join(attachmentsDir, "same-bytes.png"), PIXEL);
  fs.mkdirSync(path.join(attachmentsDir, "nested"));
  fs.writeFileSync(path.join(attachmentsDir, "nested", "note.txt"), "hi");
  fs.writeFileSync(path.join(attachmentsDir, ".DS_Store"), "junk");

  const clock = { now: new Date("2026-09-23T12:00:00Z") };
  const pick = { next: picked as string | null };
  const stateFile = path.join(dataDir, "backups.json");
  const host: BackupHost = {
    ...backupQueries,
    appVersion: "test",
    databasePath: dbPath,
    attachmentsDir: () => attachmentsDir,
    stateFile,
    pickFolder: async () => pick.next,
    now: () => clock.now,
  };

  return {
    root,
    dataDir,
    notesDir,
    attachmentsDir,
    dbPath,
    picked,
    appDir: path.join(picked, "chronicles"),
    stateFile,
    client,
    clock,
    pick,
    host,
    backups: createBackups(host),
  };
}

function advance(f: Fixture, ms: number) {
  f.clock.now = new Date(f.clock.now.getTime() + ms);
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function readManifest(f: Fixture, id: string) {
  return JSON.parse(
    fs.readFileSync(
      path.join(f.appDir, "snapshots", id, "manifest.json"),
      "utf8",
    ),
  );
}

function titles(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT title FROM documents ORDER BY title")
      .pluck()
      .all() as string[];
  } finally {
    db.close();
  }
}

function listPool(appDir: string): string[] {
  const pool = path.join(appDir, "attachments");
  if (!fs.existsSync(pool)) return [];
  return fs
    .readdirSync(pool)
    .flatMap((p) => fs.readdirSync(path.join(pool, p)))
    .sort();
}

async function addNote(f: Fixture, title: string) {
  await f.client!.documents.createDocument({
    journal: "alpha",
    content: `${title}\n`,
    frontMatter: {
      title,
      tags: [],
      createdAt: f.clock.now.toISOString(),
      updatedAt: f.clock.now.toISOString(),
    },
  });
}

function closeClient(f: Fixture) {
  f.client?.sqlite.close();
  f.client = null;
}

describe("backups", () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await fixture();
  });

  afterEach(() => {
    closeClient(f);
    fs.rmSync(f.root, { recursive: true, force: true });
  });

  describe("destination", () => {
    test("nothing runs until a destination is picked", async () => {
      await assert.rejects(f.backups.run("manual"), /BACKUP_NO_DESTINATION/);
      assert.deepEqual(await f.backups.run("activity"), {
        status: "skipped",
        reason: "no-destination",
      });
      assert.deepEqual(await f.backups.list(), []);
      assert.equal((await f.backups.status()).destination, null);
    });

    test("a cancelled picker leaves the destination unset", async () => {
      f.pick.next = null;
      assert.equal((await f.backups.pickDestination()).destination, null);
    });

    test("refuses folders that overlap the live data", async () => {
      f.pick.next = f.notesDir;
      await assert.rejects(f.backups.pickDestination(), /BACKUP_DEST_CONFLICT/);
      f.pick.next = f.dataDir;
      await assert.rejects(f.backups.pickDestination(), /BACKUP_DEST_CONFLICT/);
      assert.equal((await f.backups.status()).destination, null);
    });

    test("persists the picked folder as an opaque handle", async () => {
      const status = await f.backups.pickDestination();
      assert.equal(status.destination, f.appDir);
      const state = JSON.parse(fs.readFileSync(f.stateFile, "utf8"));
      assert.equal(state.destination, `path:${f.picked}`);

      // A fresh instance reads it back.
      const again = createBackups(f.host);
      assert.equal((await again.status()).destination, f.appDir);
    });
  });

  describe("run", () => {
    beforeEach(async () => {
      await f.backups.pickDestination();
    });

    test("publishes a verified snapshot with a pooled attachment set", async () => {
      const result = await f.backups.run("manual");
      assert.equal(result.status, "created");
      if (result.status !== "created") return;

      const id = "2026-09-23T12-00-00Z";
      assert.equal(result.snapshot.id, id);
      assert.deepEqual(result.snapshot.counts, {
        documents: 1,
        journals: 2, // alpha plus the default journal
        tags: 1,
      });

      const snapDir = path.join(f.appDir, "snapshots", id);
      assert.deepEqual(fs.readdirSync(snapDir).sort(), [
        "db.sqlite3",
        "manifest.json",
      ]);
      assert.deepEqual(
        fs.readdirSync(path.join(f.appDir, "snapshots")),
        [id],
        "no temp directories left behind",
      );
      assert.ok(!fs.existsSync(path.join(f.appDir, ".lock")));
      assert.deepEqual(titles(path.join(snapDir, "db.sqlite3")), ["First"]);

      const manifest = readManifest(f, id);
      assert.equal(manifest.trigger, "manual");
      assert.equal(manifest.createdAt, "2026-09-23T12:00:00Z");
      assert.deepEqual(
        manifest.attachments.map((a: any) => a.name),
        ["nested/note.txt", "pixel.png", "same-bytes.png"],
      );
      // Identical bytes share one blob.
      assert.equal(listPool(f.appDir).length, 2);
      for (const a of manifest.attachments) {
        assert.ok(
          fs.existsSync(blobPath(path.join(f.appDir, "attachments"), a)),
        );
      }

      const status = await f.backups.status();
      assert.equal(status.lastSuccess?.snapshot, id);
      assert.equal(status.changedSinceLastSnapshot, false);
      assert.equal(status.newest?.id, id);
    });

    test("does not rewrite blobs that are already pooled", async () => {
      await f.backups.run("manual");
      const blob = blobPath(
        path.join(f.appDir, "attachments"),
        readManifest(f, "2026-09-23T12-00-00Z").attachments[1],
      );
      const before = fs.statSync(blob).mtimeMs;
      fs.utimesSync(blob, new Date(0), new Date(0));

      advance(f, HOUR);
      await f.backups.run("manual");
      assert.equal(fs.statSync(blob).mtimeMs, 0);
      assert.ok(before > 0);
    });

    test("steps the stamp forward when two snapshots share a second", async () => {
      await f.backups.run("manual");
      const second = await f.backups.run("manual");
      assert.equal(
        second.status === "created" && second.snapshot.id,
        "2026-09-23T12-00-01Z",
      );
    });

    test("activity snapshots need both a day's age and a changed fingerprint", async () => {
      assert.equal((await f.backups.run("activity")).status, "created");

      advance(f, 23 * HOUR);
      await addNote(f, "Second");
      assert.deepEqual(await f.backups.run("activity"), {
        status: "skipped",
        reason: "recent",
      });
      assert.equal((await f.backups.status()).changedSinceLastSnapshot, true);

      advance(f, 2 * HOUR);
      assert.equal((await f.backups.run("activity")).status, "created");

      advance(f, 2 * DAY);
      assert.deepEqual(await f.backups.run("activity"), {
        status: "skipped",
        reason: "unchanged",
      });
    });

    test("deletes register in the fingerprint", async () => {
      await addNote(f, "Doomed");
      await f.backups.run("manual");
      const doomed = (await f.client!.documents.search({ titles: ["Doomed"] }))
        .data[0];
      await f.client!.documents.del(doomed.id);
      assert.equal((await f.backups.status()).changedSinceLastSnapshot, true);
    });

    test("a verification failure publishes nothing and is recorded", async () => {
      const failing = createBackups({
        ...f.host,
        counts: () => {
          throw new Error("counts exploded");
        },
      });
      await assert.rejects(failing.run("manual"), /counts exploded/);
      assert.deepEqual(fs.readdirSync(path.join(f.appDir, "snapshots")), []);
      assert.ok(!fs.existsSync(path.join(f.appDir, ".lock")));
      const status = await f.backups.status();
      assert.match(status.lastFailure?.error ?? "", /counts exploded/);
      assert.equal(status.lastSuccess, null);
    });

    test("a held lock fails the run; a stale one is taken over", async () => {
      fs.mkdirSync(f.appDir, { recursive: true });
      const lock = path.join(f.appDir, ".lock");
      fs.writeFileSync(lock, "{}");
      await assert.rejects(f.backups.run("manual"), /BACKUP_BUSY/);
      assert.match(
        (await f.backups.status()).lastFailure?.error ?? "",
        /BACKUP_BUSY/,
      );

      const old = new Date(Date.now() - 2 * HOUR);
      fs.utimesSync(lock, old, old);
      assert.equal((await f.backups.run("manual")).status, "created");
      assert.ok(!fs.existsSync(lock));
    });

    test("prunes by retention, removes invalid snapshots, and collects blobs", async () => {
      // Foreign files in the picked folder and app directory are never touched.
      fs.writeFileSync(path.join(f.picked, "notes-legacy.db"), "legacy");
      fs.mkdirSync(path.join(f.appDir, "snapshots"), { recursive: true });
      fs.writeFileSync(path.join(f.appDir, "snapshots", "README"), "mine");
      fs.mkdirSync(path.join(f.appDir, "snapshots", "2026-01-01T00-00-00Z"));
      fs.mkdirSync(path.join(f.appDir, "snapshots", ".tmp-crashed"));

      // Day 1 has an attachment that is deleted before day 2.
      fs.writeFileSync(path.join(f.attachmentsDir, "gone.bin"), "short-lived");
      await f.backups.run("manual");
      const goneSha =
        readManifest(f, "2026-09-23T12-00-00Z").attachments.find(
          (a: any) => a.name === "gone.bin",
        ).sha256 + ".bin";
      fs.rmSync(path.join(f.attachmentsDir, "gone.bin"));

      for (let day = 1; day <= 40; day++) {
        advance(f, DAY);
        await addNote(f, `Day ${day}`);
        await f.backups.run("manual");
      }

      const ids = fs.readdirSync(path.join(f.appDir, "snapshots")).sort();
      assert.ok(ids.includes("README"));
      assert.ok(
        !ids.includes("2026-01-01T00-00-00Z"),
        "invalid snapshot pruned",
      );
      assert.ok(!ids.includes(".tmp-crashed"), "stale temp dir pruned");
      const kept = ids.filter((n) => n !== "README");
      assert.ok(kept.length <= 11, `kept ${kept.length}`);
      assert.equal(kept.at(-1), "2026-11-02T12-00-00Z");
      assert.ok(!kept.includes("2026-09-23T12-00-00Z"));

      assert.ok(
        !listPool(f.appDir).includes(goneSha),
        "unreferenced blob collected",
      );
      assert.equal(listPool(f.appDir).length, 2);
      assert.equal(
        fs.readFileSync(path.join(f.picked, "notes-legacy.db"), "utf8"),
        "legacy",
      );

      const listed = await f.backups.list();
      assert.equal(listed.length, kept.length);
      assert.ok(listed[0].tiers.includes("newest"));
      assert.ok(listed.every((s) => s.tiers.length > 0));
    });
  });

  describe("restore", () => {
    let snapshotId: string;

    beforeEach(async () => {
      await f.backups.pickDestination();
      const result = await f.backups.run("manual");
      assert.equal(result.status, "created");
      snapshotId = result.status === "created" ? result.snapshot.id : "";

      advance(f, HOUR);
      await addNote(f, "After snapshot");
      fs.rmSync(path.join(f.attachmentsDir, "pixel.png"));
      fs.writeFileSync(path.join(f.attachmentsDir, "same-bytes.png"), "local");
    });

    test("refuses while the database is open", async () => {
      await assert.rejects(f.backups.restore(snapshotId), /BACKUP_DB_OPEN/);
      assert.ok(titles(f.dbPath).includes("After snapshot"));
      assert.ok(
        !fs
          .readdirSync(f.dataDir)
          .some((n) => n.startsWith(".chronicles-restore-")),
        "staged copy removed",
      );
    });

    test("swaps the database, keeps a pre-restore snapshot, and materializes attachments", async () => {
      closeClient(f);
      const result = await f.backups.restore(snapshotId);

      assert.deepEqual(titles(f.dbPath), ["First"]);
      assert.ok(!fs.existsSync(`${f.dbPath}-wal`));

      assert.ok(result.preRestoreSnapshot);
      const pre = readManifest(f, result.preRestoreSnapshot!);
      assert.equal(pre.trigger, "pre-restore");
      assert.deepEqual(
        titles(
          path.join(
            f.appDir,
            "snapshots",
            result.preRestoreSnapshot!,
            "db.sqlite3",
          ),
        ),
        ["After snapshot", "First"],
      );

      assert.deepEqual(result.attachments, {
        written: 1,
        existing: 2,
        missing: [],
      });
      assert.ok(
        fs.readFileSync(path.join(f.attachmentsDir, "pixel.png")).equals(PIXEL),
      );
      assert.equal(
        fs.readFileSync(path.join(f.attachmentsDir, "same-bytes.png"), "utf8"),
        "local",
        "existing files are left alone",
      );

      // The restored database opens and works.
      const reopened = await createClient({
        dbPath: f.dbPath,
        notesDir: f.notesDir,
      });
      assert.equal((await reopened.documents.search({})).data.length, 1);
      reopened.sqlite.close();
    });

    test("reports blobs missing from the pool", async () => {
      closeClient(f);
      const manifest = readManifest(f, snapshotId);
      const pixel = manifest.attachments.find(
        (a: any) => a.name === "pixel.png",
      );
      fs.rmSync(blobPath(path.join(f.appDir, "attachments"), pixel));
      const result = await f.backups.restore(snapshotId);
      assert.deepEqual(result.attachments.missing, ["pixel.png"]);
    });

    test("refuses a tampered snapshot database", async () => {
      closeClient(f);
      const db = new Database(
        path.join(f.appDir, "snapshots", snapshotId, "db.sqlite3"),
      );
      db.exec("DELETE FROM documents");
      db.close();
      await assert.rejects(f.backups.restore(snapshotId), /BACKUP_INTEGRITY/);
      assert.ok(titles(f.dbPath).includes("After snapshot"));
    });

    test("rejects names that are not snapshots", async () => {
      closeClient(f);
      await assert.rejects(f.backups.restore("../../data"), /BACKUP_NOT_FOUND/);
      await assert.rejects(
        f.backups.restore("2020-01-01T00-00-00Z"),
        /BACKUP_NOT_FOUND/,
      );
    });

    test("a scheduled restore runs once at the next startup", async () => {
      await f.backups.scheduleRestore(snapshotId);
      assert.equal((await f.backups.status()).pendingRestore, snapshotId);

      closeClient(f);
      const startup = createBackups(f.host);
      const result = await startup.applyPendingRestore();
      assert.equal(result?.snapshot, snapshotId);
      assert.deepEqual(titles(f.dbPath), ["First"]);

      const status = await startup.status();
      assert.equal(status.pendingRestore, null);
      assert.equal(status.lastRestore?.snapshot, snapshotId);
      assert.equal(status.lastRestore?.error, undefined);
      assert.equal(await startup.applyPendingRestore(), null);
    });

    test("a failed scheduled restore is recorded and not retried", async () => {
      await f.backups.scheduleRestore(snapshotId);
      // The client is still open, so the restore must refuse.
      await assert.rejects(f.backups.applyPendingRestore(), /BACKUP_DB_OPEN/);
      const status = await f.backups.status();
      assert.equal(status.pendingRestore, null);
      assert.match(status.lastRestore?.error ?? "", /BACKUP_DB_OPEN/);
    });
  });

  describe("pool file names", () => {
    const pool = () => path.join(f.appDir, "attachments");

    /** Rewrites the pool the way builds before the extension change left it. */
    function toBare(): string[] {
      const bare: string[] = [];
      for (const prefix of fs.readdirSync(pool())) {
        for (const name of fs.readdirSync(path.join(pool(), prefix))) {
          const sha = name.slice(0, 64);
          if (name === sha) continue;
          const to = bareBlobPath(pool(), sha);
          fs.renameSync(path.join(pool(), prefix, name), to);
          fs.utimesSync(to, new Date(0), new Date(0));
          bare.push(sha);
        }
      }
      return bare;
    }

    beforeEach(async () => {
      await f.backups.pickDestination();
    });

    test("derives the extension from the attachment name", () => {
      const cases: [string, string][] = [
        ["photo.png", ".png"],
        ["IMG_0001.JPG", ".jpg"],
        ["nested/dir/clip.WebM", ".webm"],
        ["archive.tar.gz", ".gz"],
        ["dir.v2/noext", ""],
        ["noext", ""],
        [".hidden", ""],
        ["trailing.", ""],
        ["spaced.jp g", ""],
        ["unicode.pñg", ""],
        ["dash.tar-gz", ""],
        ["ten.abcdefghij", ".abcdefghij"],
        ["eleven.abcdefghijk", ""],
      ];
      for (const [name, ext] of cases) {
        assert.equal(blobExtension(name), ext, name);
      }
    });

    test("blobs keep the extension; identical bytes under two extensions are stored twice", async () => {
      fs.writeFileSync(path.join(f.attachmentsDir, "pixel-copy.gif"), PIXEL);
      await f.backups.run("manual");
      const files = listPool(f.appDir);
      const pixelSha = readManifest(f, "2026-09-23T12-00-00Z").attachments.find(
        (a: any) => a.name === "pixel.png",
      ).sha256;
      assert.ok(files.includes(`${pixelSha}.png`));
      assert.ok(files.includes(`${pixelSha}.gif`));
      assert.ok(!files.includes(pixelSha));
      assert.equal(files.length, 3); // .png, .gif, note .txt
    });

    test("renames bare blobs from earlier builds instead of rewriting them", async () => {
      await f.backups.run("manual");
      const bare = toBare();
      assert.equal(bare.length, 2);

      advance(f, HOUR);
      await f.backups.run("manual");
      for (const a of readManifest(f, "2026-09-23T13-00-00Z").attachments) {
        const target = blobPath(pool(), a);
        assert.equal(fs.statSync(target).mtimeMs, 0, `${a.name} renamed`);
        assert.ok(!fs.existsSync(bareBlobPath(pool(), a.sha256)));
      }
    });

    test("GC keeps bare blobs surviving snapshots need and deletes the rest", async () => {
      fs.writeFileSync(path.join(f.attachmentsDir, "old.bin"), "only in 12:00");
      await f.backups.run("manual");
      const oldSha = readManifest(f, "2026-09-23T12-00-00Z").attachments.find(
        (a: any) => a.name === "old.bin",
      ).sha256;
      toBare();
      fs.rmSync(path.join(f.attachmentsDir, "old.bin"));
      const stray = "ab".padEnd(64, "0");
      fs.mkdirSync(path.join(pool(), "ab"), { recursive: true });
      fs.writeFileSync(bareBlobPath(pool(), stray), "unreferenced");

      advance(f, HOUR);
      await f.backups.run("manual");

      const files = listPool(f.appDir);
      assert.ok(!files.includes(stray), "unreferenced bare blob deleted");
      assert.ok(
        files.includes(`${oldSha}.bin`),
        "bare blob of a surviving snapshot adopted under its extension",
      );
      assert.ok(files.every((n) => /^[0-9a-f]{64}\.[a-z0-9]+$/.test(n)));
    });

    test("restore falls back to a bare blob", async () => {
      await f.backups.run("manual");
      const manifest = readManifest(f, "2026-09-23T12-00-00Z");
      toBare();
      const out = path.join(f.root, "restored");
      const result = await materializeAttachments(
        manifest.attachments,
        pool(),
        out,
      );
      assert.deepEqual(result, { written: 3, existing: 0, missing: [] });
      assert.ok(fs.readFileSync(path.join(out, "pixel.png")).equals(PIXEL));
      assert.equal(
        fs.readFileSync(path.join(out, "nested", "note.txt"), "utf8"),
        "hi",
      );
    });

    test("a full restore works from a pool left by an earlier build", async () => {
      await f.backups.run("manual");
      toBare();
      fs.rmSync(path.join(f.attachmentsDir, "pixel.png"));
      closeClient(f);
      advance(f, HOUR);
      const result = await f.backups.restore("2026-09-23T12-00-00Z");
      assert.deepEqual(result.attachments.missing, []);
      assert.equal(result.attachments.written, 1);
      assert.ok(
        fs.readFileSync(path.join(f.attachmentsDir, "pixel.png")).equals(PIXEL),
      );
    });
  });

  describe("manifest conformance", () => {
    const vendored = path.join(here, "backup-manifest.schema.json");
    const shared = path.resolve(
      here,
      "../../../docs/backup-manifest.schema.json",
    );

    test("emitted manifests validate against the shared schema", async () => {
      await f.backups.pickDestination();
      await f.backups.run("manual");
      const schema = JSON.parse(fs.readFileSync(vendored, "utf8"));
      const ajv = new Ajv2020({ strict: true, allErrors: true });
      const validate = ajv.compile(schema);
      const manifest = readManifest(f, "2026-09-23T12-00-00Z");
      assert.ok(validate(manifest), JSON.stringify(validate.errors, null, 2));
    });

    test(
      "the vendored schema matches code/docs when it is checked out",
      { skip: !fs.existsSync(shared) && "code/docs is not beside this repo" },
      () => {
        assert.deepEqual(
          JSON.parse(fs.readFileSync(vendored, "utf8")),
          JSON.parse(fs.readFileSync(shared, "utf8")),
        );
      },
    );
  });
});
