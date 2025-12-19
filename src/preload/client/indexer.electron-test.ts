import { ipcRenderer } from "electron";
import fs from "fs";
import { Knex } from "knex";
import assert from "node:assert";
import { after, before, test } from "node:test";
import path from "path";

import store from "../../electron/settings";
import { Client, setup } from "../test-util";
import { createId } from "./util";

let client: Client;
let knex: Knex;
let tempDir: string;

before(async () => {
  const setupResult = await setup();
  client = setupResult.client;
  knex = setupResult.knex;

  // Get the temp directory from the current notesDir setting
  tempDir = path.dirname((await client.preferences.get("notesDir")) as string);
});

after(async () => {
  console.log("All tests complete, signaling completion to electron runner");
  ipcRenderer.send("test-complete", 0);
});

test("indexer switches directories and indexes correct documents", async () => {
  // Generate proper UUID25 IDs
  const doc1Id = createId(new Date("2024-01-01").getTime());
  const doc2Id = createId(new Date("2024-01-02").getTime());

  // 1. Create first directory with one document
  const dir1 = path.join(tempDir, "dir1");
  const dir1Journal = path.join(dir1, "journal1");
  fs.mkdirSync(dir1Journal, { recursive: true });

  const doc1Content = `---
title: Document from Directory 1
tags: []
createdAt: 2024-01-01T00:00:00.000Z
updatedAt: 2024-01-01T00:00:00.000Z
---

# Document from Directory 1

This is from the first directory.
`;
  fs.writeFileSync(path.join(dir1Journal, `${doc1Id}.md`), doc1Content);

  // 2. Create second directory with one document
  const dir2 = path.join(tempDir, "dir2");
  const dir2Journal = path.join(dir2, "journal2");
  fs.mkdirSync(dir2Journal, { recursive: true });

  const doc2Content = `---
title: Document from Directory 2
tags: []
createdAt: 2024-01-02T00:00:00.000Z
updatedAt: 2024-01-02T00:00:00.000Z
---

# Document from Directory 2

This is from the second directory.
`;
  fs.writeFileSync(path.join(dir2Journal, `${doc2Id}.md`), doc2Content);

  // 3. Set preferences to first directory and index
  store.set("notesDir", dir1);
  await client.indexer.index(true); // fullReindex=true to skip mtime/hash checks

  // 4. Verify documents from first directory exist
  const resultsAfterFirstIndex = await client.documents.search();
  assert.strictEqual(
    resultsAfterFirstIndex.data.length,
    1,
    "Expected one document after first index",
  );
  assert.strictEqual(
    resultsAfterFirstIndex.data[0].title,
    "Document from Directory 1",
    "Expected document from first directory",
  );

  // 5. Switch to second directory and index
  store.set("notesDir", dir2);
  await client.indexer.index(true); // fullReindex=true

  // 6. Verify documents from second directory exist (not first)
  const resultsAfterSecondIndex = await client.documents.search();
  assert.strictEqual(
    resultsAfterSecondIndex.data.length,
    1,
    "Expected one document after second index",
  );
  assert.strictEqual(
    resultsAfterSecondIndex.data[0].title,
    "Document from Directory 2",
    "Expected document from second directory, not first",
  );

  // Additional verification: ensure first document is NOT in database
  const doc1Check = await knex("documents").where("id", doc1Id).first();
  assert.strictEqual(
    doc1Check,
    undefined,
    "Document from first directory should not exist after switching",
  );

  // Create a new document and folder
  const doc3Id = createId(new Date("2024-01-01").getTime());
  const doc3Content = `---
  title: Test Document 3
  tags: []
  createdAt: 2024-01-01T00:00:00.000Z
  updatedAt: 2024-01-01T00:00:00.000Z
  ---
  # Test Document 3
  This is a test document 3.
  `;

  const journal3 = path.join(dir2, "journal3");
  fs.mkdirSync(journal3, { recursive: true });
  fs.writeFileSync(path.join(journal3, `${doc3Id}.md`), doc3Content);

  // First, assert that needsFullReindex returns false
  const needsFullReindex = await client.indexer.needsFullReindex();
  assert.strictEqual(
    needsFullReindex,
    false,
    "Expected needsFullReindex to return false",
  );

  // Not yet indexed, so document should not be findable by documents client
  assert.rejects(() => {
    return client.documents.findById({ id: doc3Id });
  });

  // Run index, no fullReindex. Should pick up new document.
  await client.indexer.index(false);
  assert.equal((await client.documents.findById({ id: doc3Id })).id, doc3Id);
});
