import { ipcRenderer } from "electron";
import { Knex } from "knex";
import assert from "node:assert";
import { after, before, test } from "node:test";

import { Client, cleanup, setup } from "../test-util";

let client: Client;
let testdir: string;
let knex: Knex;

before(async () => {
  await cleanup();
  const setupResult = await setup();
  client = setupResult.client;
  testdir = setupResult.testdir;
  knex = setupResult.knex;
});

after(async () => {
  await cleanup();
  console.log("All tests complete, signaling completion to electron runner");
  ipcRenderer.send("test-complete", 0);
});

test("create test documents", async () => {
  // Create a test journal
  await client.journals.create({ name: "test-journal" });

  // Create three test documents
  const doc1 = await client.documents.createDocument({
    journal: "test-journal",
    content: "# Document 1\n\nThis is test document 1.",
    frontMatter: {
      title: "Document 1",
      tags: ["existing-tag"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  const doc2 = await client.documents.createDocument({
    journal: "test-journal",
    content: "# Document 2\n\nThis is test document 2.",
    frontMatter: {
      title: "Document 2",
      tags: ["existing-tag", "another-tag"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  const doc3 = await client.documents.createDocument({
    journal: "test-journal",
    content: "# Document 3\n\nThis is test document 3.",
    frontMatter: {
      title: "Document 3",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  assert.ok(doc1, "Document 1 created");
  assert.ok(doc2, "Document 2 created");
  assert.ok(doc3, "Document 3 created");
});

test("bulk add tag operation", async () => {
  // Setup search; sanity check results count
  const search = {
    journals: ["test-journal"],
  };

  const docs = await client.documents.search(search);

  assert.strictEqual(docs.data.length, 3, "Found 3 documents");

  // Create bulk operation to add tag

  const operationId = await client.bulkOperations.create({
    type: "add_tag",
    search: search,
    params: { tag: "bulk-added-tag" },
  });

  assert.ok(operationId, "Operation created");

  // Check operation was created
  const operation = await client.bulkOperations.get(operationId);
  assert.strictEqual(operation.operation.type, "add_tag");
  assert.strictEqual(operation.operation.status, "pending");
  assert.strictEqual(operation.operation.totalItems, 3);
  assert.strictEqual(operation.items.length, 3);

  // Process the operation
  await client.bulkOperations.process(operationId);

  // Verify operation completed
  const completedOp = await client.bulkOperations.get(operationId);
  assert.strictEqual(completedOp.operation.status, "completed");
  assert.strictEqual(completedOp.operation.successCount, 3);
  assert.strictEqual(completedOp.operation.errorCount, 0);

  // Verify all items succeeded
  completedOp.items.forEach((item) => {
    assert.strictEqual(item.status, "success");
  });

  // Verify tags were added to documents
  const verifyDoc1 = await client.documents.findByTitle("Document 1");
  const verifyDoc2 = await client.documents.findByTitle("Document 2");
  const verifyDoc3 = await client.documents.findByTitle("Document 3");

  assert.ok(
    verifyDoc1.frontMatter.tags.includes("bulk-added-tag"),
    "Document 1 has bulk-added-tag",
  );
  assert.ok(
    verifyDoc2.frontMatter.tags.includes("bulk-added-tag"),
    "Document 2 has bulk-added-tag",
  );
  assert.ok(
    verifyDoc3.frontMatter.tags.includes("bulk-added-tag"),
    "Document 3 has bulk-added-tag",
  );

  // Verify original tags are preserved
  assert.ok(
    verifyDoc1.frontMatter.tags.includes("existing-tag"),
    "Document 1 still has existing-tag",
  );
  assert.ok(
    verifyDoc2.frontMatter.tags.includes("another-tag"),
    "Document 2 still has another-tag",
  );
});

test("bulk remove tag operation", async () => {
  // Get just Document 1 and Document 2
  const doc1 = await client.documents.findByTitle("Document 1");
  const doc2 = await client.documents.findByTitle("Document 2");
  const documentIds = [doc1.id, doc2.id];

  // Create bulk operation to remove tag
  const operationId = await client.bulkOperations.create({
    type: "remove_tag",
    search: { ids: documentIds },
    params: { tag: "existing-tag" },
  });

  // Process the operation
  await client.bulkOperations.process(operationId);

  // Verify operation completed
  const completedOp = await client.bulkOperations.get(operationId);
  assert.strictEqual(completedOp.operation.status, "completed");
  assert.strictEqual(completedOp.operation.successCount, 2);
  assert.strictEqual(completedOp.operation.errorCount, 0);

  // Verify tag was removed
  const updatedDoc1 = await client.documents.findByTitle("Document 1");
  const updatedDoc2 = await client.documents.findByTitle("Document 2");

  assert.ok(
    !updatedDoc1.frontMatter.tags.includes("existing-tag"),
    "Document 1 no longer has existing-tag",
  );
  assert.ok(
    !updatedDoc2.frontMatter.tags.includes("existing-tag"),
    "Document 2 no longer has existing-tag",
  );

  // Verify other tags are preserved
  assert.ok(
    updatedDoc1.frontMatter.tags.includes("bulk-added-tag"),
    "Document 1 still has bulk-added-tag",
  );
  assert.ok(
    updatedDoc2.frontMatter.tags.includes("another-tag"),
    "Document 2 still has another-tag",
  );
});

test("bulk change journal operation", async () => {
  // Create a second journal
  await client.journals.create({ name: "new-journal" });

  // Get Document 1 and Document 2
  const doc1 = await client.documents.findByTitle("Document 1");
  const doc2 = await client.documents.findByTitle("Document 2");
  const documentIds = [doc1.id, doc2.id];

  // Create bulk operation to change journal
  const operationId = await client.bulkOperations.create({
    type: "change_journal",
    search: { ids: documentIds },
    params: { journal: "new-journal" },
  });

  // Process the operation
  await client.bulkOperations.process(operationId);

  // Verify operation completed
  const completedOp = await client.bulkOperations.get(operationId);
  assert.strictEqual(completedOp.operation.status, "completed");
  assert.strictEqual(completedOp.operation.successCount, 2);
  assert.strictEqual(completedOp.operation.errorCount, 0);

  // Verify documents moved to new journal
  const movedDoc1 = await client.documents.findByTitle("Document 1");
  const movedDoc2 = await client.documents.findByTitle("Document 2");

  assert.strictEqual(
    movedDoc1.journal,
    "new-journal",
    "Document 1 moved to new-journal",
  );
  assert.strictEqual(
    movedDoc2.journal,
    "new-journal",
    "Document 2 moved to new-journal",
  );

  // Verify Document 3 is still in original journal
  const stillDoc3 = await client.documents.findByTitle("Document 3");
  assert.strictEqual(
    stillDoc3.journal,
    "test-journal",
    "Document 3 still in test-journal",
  );
});

test("list bulk operations", async () => {
  const operations = await client.bulkOperations.list();

  // Should have 3 operations from previous tests
  assert.ok(operations.length >= 3, "At least 3 operations exist");

  // All should be completed
  operations.forEach((op) => {
    assert.strictEqual(op.status, "completed");
  });
});

test("raises error if search returns no documents", async () => {
  assert.rejects(
    client.bulkOperations.create({
      type: "add_tag",
      search: { ids: ["invalid-doc-id"] },
      params: { tag: "test-tag" },
    }),
  );

  // await client.bulkOperations.process(operationId);

  // const completedOp = await client.bulkOperations.get(operationId);
  // assert.strictEqual(completedOp.operation.status, "completed");
  // assert.strictEqual(completedOp.operation.successCount, 0);
  // assert.strictEqual(completedOp.operation.errorCount, 1);

  // try {
  //   // Verify error was recorded
  //   const failedItem = completedOp.items.find(
  //     (item) => item.status === "error",
  //   );
  // } catch (err) {
  //   console.log("???", JSON.stringify(err, null, 2));
  // }
  // assert.ok(failedItem, "Found failed item");
  // assert.ok(failedItem.error, "Error message was recorded");
  // assert.ok(
  //   failedItem.error.includes("DOCUMENT_NOT_FOUND"),
  //   "Error is document not found",
  // );
});

test("validation - missing tag parameter", async () => {
  await assert.rejects(
    client.bulkOperations.create({
      type: "add_tag",
      search: {
        ids: (await client.documents.search()).data.map((doc) => doc.id),
      },
      params: {},
    }),
    {
      message: "Operation add_tag requires 'tag' parameter",
    },
  );
});

test("validation - missing journal parameter", async () => {
  await assert.rejects(
    async () => {
      await client.bulkOperations.create({
        type: "change_journal",
        search: {
          ids: (await client.documents.search()).data.map((doc) => doc.id),
        },
        params: {},
      });
    },
    {
      message: "Operation change_journal requires 'journal' parameter",
    },
  );
});

test("validation - empty document list", async () => {
  await assert.rejects(
    async () => {
      await client.bulkOperations.create({
        type: "add_tag",
        search: { ids: [] },
        params: { tag: "test" },
      });
    },
    {
      message: "No documents provided for bulk operation",
    },
  );
});

test("check database tables and indexes exist", async () => {
  // Verify tables exist by querying them
  const operations = await knex("bulk_operations").select("*");
  const items = await knex("bulk_operation_items").select("*");

  assert.ok(Array.isArray(operations), "bulk_operations table exists");
  assert.ok(Array.isArray(items), "bulk_operation_items table exists");

  // Verify we have some operations from previous tests
  assert.ok(operations.length > 0, "Operations were created");
});
