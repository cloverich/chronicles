import { ipcRenderer } from "electron";
import fs from "fs";
import { Knex } from "knex";
import assert from "node:assert";
import { after, before, test } from "node:test";
import path from "path";

import { Client, setup } from "../test-util";
import { createId } from "./util";

let client: Client;
let knex: Knex;
let tempDir: string;
let notesDir: string;

before(async () => {
  const setupResult = await setup();
  client = setupResult.client;
  knex = setupResult.knex;

  // Get the temp directory from the current notesDir setting
  notesDir = (await client.preferences.get("notesDir")) as string;
  tempDir = path.dirname(notesDir);
});

after(async () => {
  console.log("All tests complete, signaling completion to electron runner");
  ipcRenderer.send("test-complete", 0);
});

test("search respects excludedTags", async () => {
  const journalDir = path.join(notesDir, "test-journal");
  fs.mkdirSync(journalDir, { recursive: true });

  const createDoc = (title: string, tags: string[]) => {
    const id = createId(new Date().getTime());
    const content = `---
title: ${title}
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
createdAt: ${new Date().toISOString()}
updatedAt: ${new Date().toISOString()}
---

# ${title}
`;
    fs.writeFileSync(path.join(journalDir, `${id}.md`), content);
    return id;
  };

  const doc1Id = createDoc("Doc 1", ["alpha", "beta"]);
  const doc2Id = createDoc("Doc 2", ["beta", "gamma"]);
  const doc3Id = createDoc("Doc 3", ["alpha"]);
  const doc4Id = createDoc("Doc 4", []); // No tags

  // Index
  await client.indexer.index(true);

  // Test 1: Exclude 'gamma'
  // Should return doc1, doc3, doc4. doc2 has gamma.
  const res1 = await client.documents.search({
    exclude: { tags: ["gamma"] },
  });
  const ids1 = res1.data.map((d) => d.id);
  assert.ok(ids1.includes(doc1Id), "Should include doc1");
  assert.ok(ids1.includes(doc3Id), "Should include doc3");
  assert.ok(ids1.includes(doc4Id), "Should include doc4");
  assert.ok(!ids1.includes(doc2Id), "Should exclude doc2 (has gamma)");

  // Test 2: Include 'alpha', Exclude 'beta'
  // Should return doc3 only. doc1 has alpha but also beta.
  const res2 = await client.documents.search({
    tags: ["alpha"],
    exclude: { tags: ["beta"] },
  });
  const ids2 = res2.data.map((d) => d.id);
  assert.ok(ids2.includes(doc3Id), "Should include doc3");
  assert.ok(!ids2.includes(doc1Id), "Should exclude doc1 (has beta)");
  assert.ok(
    !ids2.includes(doc2Id),
    "Should exclude doc2 (no alpha + has beta)",
  );
  assert.ok(!ids2.includes(doc4Id), "Should exclude doc4 (no alpha)");

  // Test 3: Exclude multiple tags
  // Exclude 'beta' and 'gamma'
  // Should return doc3 and doc4.
  const res3 = await client.documents.search({
    exclude: { tags: ["beta", "gamma"] },
  });
  const ids3 = res3.data.map((d) => d.id);
  assert.ok(ids3.includes(doc3Id), "Should include doc3");
  assert.ok(ids3.includes(doc4Id), "Should include doc4");
  assert.ok(!ids3.includes(doc1Id), "Should exclude doc1 (has beta)");
  assert.ok(!ids3.includes(doc2Id), "Should exclude doc2 (has beta and gamma)");

  // Test 4: Exclude journal
  // Create docs in another journal
  const journal2Dir = path.join(notesDir, "journal-excluded");
  fs.mkdirSync(journal2Dir, { recursive: true });

  const doc5Id = createId(new Date().getTime());
  const doc5Content = `---
title: Doc 5
tags: []
createdAt: ${new Date().toISOString()}
updatedAt: ${new Date().toISOString()}
---

# Doc 5
`;
  fs.writeFileSync(path.join(journal2Dir, `${doc5Id}.md`), doc5Content);

  // Re-index to pick up new journal/doc
  await client.indexer.index(false);

  // Search excluding "test-journal" (where docs 1-4 are)
  const res4 = await client.documents.search({
    exclude: { journals: ["test-journal"] },
  });
  const ids4 = res4.data.map((d) => d.id);

  assert.ok(ids4.includes(doc5Id), "Should include doc5 from journal-excluded");
  assert.ok(!ids4.includes(doc1Id), "Should exclude doc1 from test-journal");
});
