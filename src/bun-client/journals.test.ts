import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

beforeAll(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-journals-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

test("create journal → appears in list", async () => {
  await client.journals.create({ name: "alpha" });
  const list = await client.journals.list();
  expect(list.some((j) => j.name === "alpha")).toBe(true);
});

test("rename journal → old name gone, new name present", async () => {
  await client.journals.create({ name: "rename-me" });
  const before = await client.journals.list();
  const journal = before.find((j) => j.name === "rename-me")!;
  await client.journals.rename(journal, "renamed");

  const after = await client.journals.list();
  expect(after.some((j) => j.name === "rename-me")).toBe(false);
  expect(after.some((j) => j.name === "renamed")).toBe(true);
});

test("archive toggles archived flag to true", async () => {
  await client.journals.create({ name: "to-archive" });
  await client.journals.create({ name: "extra-so-archive-allowed" });

  await client.journals.archive("to-archive");

  const list = await client.journals.list();
  const j = list.find((x) => x.name === "to-archive")!;
  expect(j.archived).toBe(true);
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
  expect(j.archived).toBe(false);
});

test("remove journal → gone from list", async () => {
  await client.journals.create({ name: "to-remove" });
  await client.journals.create({ name: "stays-around" });

  await client.journals.remove("to-remove");

  const list = await client.journals.list();
  expect(list.some((j) => j.name === "to-remove")).toBe(false);
});

test("attempting to remove last journal throws", async () => {
  // Create a fresh client with only one journal
  const dir = mkdtempSync(tmpdir() + "/chronicles-single-journal-");
  try {
    const solo = await createClient({ dbPath: ":memory:", notesDir: dir });
    await solo.journals.create({ name: "only-one" });
    await expect(solo.journals.remove("only-one")).rejects.toThrow(
      "Cannot delete the last journal",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("name validation: empty name throws", async () => {
  await expect(client.journals.create({ name: "" })).rejects.toThrow(
    "Journal name cannot be empty",
  );
});

test("name validation: too long throws", async () => {
  await expect(
    client.journals.create({ name: "a".repeat(26) }),
  ).rejects.toThrow("exceeds max length");
});

test("name validation: _attachments throws", async () => {
  await expect(
    client.journals.create({ name: "_attachments" }),
  ).rejects.toThrow("_attachments");
});

test("name validation: path-traversal throws", async () => {
  await expect(client.journals.create({ name: "../escape" })).rejects.toThrow();
});
