import { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-journals-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

test("create journal → appears in list", async () => {
  await client.journals.create({ name: "alpha" });
  const list = await client.journals.list();
  assert.ok(list.some((j) => j.name === "alpha"));
});

test("rename journal → old name gone, new name present", async () => {
  await client.journals.create({ name: "rename-me" });
  const before = await client.journals.list();
  const journal = before.find((j) => j.name === "rename-me")!;
  await client.journals.rename(journal, "renamed");

  const after = await client.journals.list();
  assert.ok(!after.some((j) => j.name === "rename-me"));
  assert.ok(after.some((j) => j.name === "renamed"));
});

test("archive toggles archived flag to true", async () => {
  await client.journals.create({ name: "to-archive" });
  await client.journals.create({ name: "extra-so-archive-allowed" });

  await client.journals.archive("to-archive");

  const list = await client.journals.list();
  const j = list.find((x) => x.name === "to-archive")!;
  assert.strictEqual(j.archived, true);
});

test("unarchive toggles archived flag to false", async () => {
  const list = await client.journals.list();
  const archived = list.find((j) => j.archived);
  if (!archived) {
    // ensure one exists
    await client.journals.create({ name: "unarchive-me" });
    await client.journals.archive("unarchive-me");
  }

  const journalName = archived?.name ?? "unarchive-me";
  await client.journals.unarchive(journalName);

  const after = await client.journals.list();
  const j = after.find((x) => x.name === journalName)!;
  assert.strictEqual(j.archived, false);
});

test("remove journal → gone from list", async () => {
  await client.journals.create({ name: "to-remove" });
  await client.journals.create({ name: "stays-around" });

  await client.journals.remove("to-remove");

  const list = await client.journals.list();
  assert.ok(!list.some((j) => j.name === "to-remove"));
});

test("attempting to remove last journal throws", async () => {
  // Fresh client: ensureDefault() has already created the sole journal
  // (default_journal) at createClient() time.
  const dir = mkdtempSync(tmpdir() + "/chronicles-single-journal-");
  try {
    const solo = await createClient({ dbPath: ":memory:", notesDir: dir });
    const list = await solo.journals.list();
    assert.strictEqual(list.length, 1);
    await assert.rejects(
      solo.journals.remove(list[0].name),
      /Cannot delete the last journal/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("name validation: empty name throws", async () => {
  await assert.rejects(
    client.journals.create({ name: "" }),
    /Journal name cannot be empty/,
  );
});

test("name validation: too long throws", async () => {
  await assert.rejects(
    client.journals.create({ name: "a".repeat(26) }),
    /exceeds max length/,
  );
});

test("name validation: _attachments throws", async () => {
  await assert.rejects(
    client.journals.create({ name: "_attachments" }),
    /_attachments/,
  );
});

test("name validation: path-traversal throws", async () => {
  await assert.rejects(client.journals.create({ name: "../escape" }));
});

test("ensureDefault: fresh client gets a single default_journal, set as defaultJournal preference", async () => {
  const dir = mkdtempSync(tmpdir() + "/chronicles-ensure-default-");
  try {
    const fresh = await createClient({ dbPath: ":memory:", notesDir: dir });
    const list = await fresh.journals.list();
    assert.deepStrictEqual(
      list.map((j) => j.name),
      ["default_journal"],
    );
    assert.strictEqual(
      await fresh.preferences.get("defaultJournal"),
      "default_journal",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureDefault: resets defaultJournal preference when it names a missing journal", async () => {
  const dir = mkdtempSync(tmpdir() + "/chronicles-ensure-default-reset-");
  try {
    const fresh = await createClient({ dbPath: ":memory:", notesDir: dir });
    // Simulate a stale preference pointing at a journal that no longer exists.
    await fresh.preferences.set("defaultJournal", "does-not-exist");
    await fresh.journals.ensureDefault();

    const list = await fresh.journals.list();
    assert.strictEqual(
      await fresh.preferences.get("defaultJournal"),
      list[0].name,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
