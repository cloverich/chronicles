import { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-prefs-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

test("get/set/delete round-trips", async () => {
  await client.preferences.set("defaultJournal", "My Journal");
  const value = await client.preferences.get("defaultJournal");
  assert.strictEqual(value, "My Journal");

  await client.preferences.delete("defaultJournal");
  const afterDelete = await client.preferences.get("defaultJournal");
  // conf returns undefined for a deleted key (null default not propagated)
  assert.ok(afterDelete == null);
});

test("nested dotted-path set works", async () => {
  await client.preferences.set("archivedJournals.travel", true);
  const value = await client.preferences.get("archivedJournals");
  assert.ok(value !== null && value !== undefined);
  assert.strictEqual((value as Record<string, unknown>).travel, true);
});

test("returns defaults when key missing", async () => {
  const darkMode = await client.preferences.get("darkMode");
  // "system" is the default from APPEARANCE_DEFAULTS
  assert.strictEqual(darkMode, "system");
});

test("all() returns full preferences object with defaults merged", async () => {
  const all = await client.preferences.all();
  assert.ok(Object.prototype.hasOwnProperty.call(all, "darkMode"));
  assert.ok(Object.prototype.hasOwnProperty.call(all, "fonts"));
  assert.ok(Object.prototype.hasOwnProperty.call(all, "fontSizes"));
});

test("setMultiple updates several keys at once", async () => {
  await client.preferences.setMultiple({
    onboarding: "complete",
    defaultJournal: "Work",
  });
  assert.strictEqual(await client.preferences.get("onboarding"), "complete");
  assert.strictEqual(await client.preferences.get("defaultJournal"), "Work");
});

test("replace overwrites the entire preferences object", async () => {
  const all = await client.preferences.all();
  const updated = { ...all, defaultJournal: "Replaced" };
  await client.preferences.replace(updated);
  assert.strictEqual(
    await client.preferences.get("defaultJournal"),
    "Replaced",
  );
});

test("settings file is written under notesDir by default", () => {
  const expectedPath = path.join(notesDir, "settings.json");
  assert.strictEqual(client.preferences.settingsPath(), expectedPath);
});
