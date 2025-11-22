import { ipcRenderer } from "electron";
import assert from "node:assert";
import { after, before, test } from "node:test";

import { Client, setup } from "../test-util";

let client: Client;

before(async () => {
  const setupResult = await setup();
  client = setupResult.client;
});

after(async () => {
  console.log("All tests complete, signaling completion to electron runner");
  ipcRenderer.send("test-complete", 0);
});

test("should not allow archiving the last journal", async () => {
  // Create a single journal
  await client.journals.create({ name: "test_journal" });

  // Attempt to archive the only journal - should throw error
  await assert.rejects(
    async () => {
      await client.journals.archive("test_journal");
    },
    {
      message: "Cannot archive the last journal. Create a new journal first.",
    },
  );
});

test("should allow archiving when multiple journals exist", async () => {
  // Create two journals
  await client.journals.create({ name: "journal_one" });
  await client.journals.create({ name: "journal_two" });

  // Archive one journal
  await client.journals.archive("journal_one");

  // Verify it's archived in the list
  const journals = await client.journals.list();
  const archivedJournal = journals.find((j) => j.name === "journal_one");

  assert.strictEqual(archivedJournal?.archived, true);
});

test("should unarchive a journal", async () => {
  // Create and archive a journal
  await client.journals.create({ name: "test_archive" });
  await client.journals.create({ name: "another_journal" });
  await client.journals.archive("test_archive");

  // Verify it's archived
  let journals = await client.journals.list();
  let journal = journals.find((j) => j.name === "test_archive");
  assert.strictEqual(journal?.archived, true);

  // Unarchive it
  await client.journals.unarchive("test_archive");

  // Verify it's unarchived
  journals = await client.journals.list();
  journal = journals.find((j) => j.name === "test_archive");
  assert.strictEqual(journal?.archived, false);
});

test("should use correct preference keys", async () => {
  // Create and archive a journal
  await client.journals.create({ name: "pref_test" });
  await client.journals.create({ name: "pref_test_2" });
  await client.journals.archive("pref_test");

  // Check preferences use correct key format (archivedJournals.{name})
  const archivedJournals = await client.preferences.get("archivedJournals");

  assert.strictEqual(
    archivedJournals.pref_test,
    true,
    "Expected preference key archivedJournals.pref_test to be true",
  );
});
