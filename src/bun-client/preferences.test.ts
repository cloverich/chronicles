import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

beforeAll(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-prefs-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });
});

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

test("get/set/delete round-trips", async () => {
  await client.preferences.set("defaultJournal", "My Journal");
  const value = await client.preferences.get("defaultJournal");
  expect(value).toBe("My Journal");

  await client.preferences.delete("defaultJournal");
  const afterDelete = await client.preferences.get("defaultJournal");
  // conf returns undefined for a deleted key (null default not propagated)
  expect(afterDelete == null).toBe(true);
});

test("nested dotted-path set works", async () => {
  await client.preferences.set("archivedJournals.travel", true);
  const value = await client.preferences.get("archivedJournals");
  expect(value).toMatchObject({ travel: true });
});

test("returns defaults when key missing", async () => {
  const darkMode = await client.preferences.get("darkMode");
  // "system" is the default from APPEARANCE_DEFAULTS
  expect(darkMode).toBe("system");
});

test("all() returns full preferences object with defaults merged", async () => {
  const all = await client.preferences.all();
  expect(all).toHaveProperty("darkMode");
  expect(all).toHaveProperty("fonts");
  expect(all).toHaveProperty("fontSizes");
});

test("setMultiple updates several keys at once", async () => {
  await client.preferences.setMultiple({
    onboarding: "complete",
    defaultJournal: "Work",
  });
  expect(await client.preferences.get("onboarding")).toBe("complete");
  expect(await client.preferences.get("defaultJournal")).toBe("Work");
});

test("replace overwrites the entire preferences object", async () => {
  const all = await client.preferences.all();
  const updated = { ...all, defaultJournal: "Replaced" };
  await client.preferences.replace(updated);
  expect(await client.preferences.get("defaultJournal")).toBe("Replaced");
});

test("settings file is written under notesDir by default", () => {
  const expectedPath = path.join(notesDir, "settings.json");
  expect(client.preferences.settingsPath()).toBe(expectedPath);
});
