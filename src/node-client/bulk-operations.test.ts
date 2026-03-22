import { mkdtempSync, rmSync } from "fs";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

// IDs of docs created in the first test, used across tests
let doc1Id: string;
let doc2Id: string;
let doc3Id: string;

before(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-bulk-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });

  // Create journals
  await client.journals.create({ name: "test-journal" });

  // Create three test documents
  const [id1] = await client.documents.createDocument({
    journal: "test-journal",
    content: "This is test document 1.",
    frontMatter: {
      title: "Document 1",
      tags: ["existing-tag"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  doc1Id = id1;

  const [id2] = await client.documents.createDocument({
    journal: "test-journal",
    content: "This is test document 2.",
    frontMatter: {
      title: "Document 2",
      tags: ["existing-tag", "another-tag"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  doc2Id = id2;

  const [id3] = await client.documents.createDocument({
    journal: "test-journal",
    content: "This is test document 3.",
    frontMatter: {
      title: "Document 3",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  doc3Id = id3;
});

after(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("bulk add_tag operation", () => {
  test("adds tag to all matching documents and preserves existing tags", async () => {
    const search = { journals: ["test-journal"] };

    // Verify search finds 3 documents
    const docs = await client.documents.search(search);
    assert.strictEqual(docs.data.length, 3);

    // Create bulk operation
    const operationId = await client.bulkOperations.create({
      type: "add_tag",
      search,
      params: { tag: "bulk-added-tag" },
    });

    assert.ok(operationId);

    // Verify operation was created in pending state
    const operation = await client.bulkOperations.get(operationId);
    assert.strictEqual(operation.operation.type, "add_tag");
    assert.strictEqual(operation.operation.status, "pending");
    assert.strictEqual(operation.operation.totalItems, 3);
    assert.strictEqual(operation.items.length, 3);

    // Process the operation
    await client.bulkOperations.process(operationId);

    // Verify operation completed successfully
    const completedOp = await client.bulkOperations.get(operationId);
    assert.strictEqual(completedOp.operation.status, "completed");
    assert.strictEqual(completedOp.operation.successCount, 3);
    assert.strictEqual(completedOp.operation.errorCount, 0);

    // Verify all items succeeded
    for (const item of completedOp.items) {
      assert.strictEqual(item.status, "success");
    }

    // Verify tags were added to documents
    const verifyDoc1 = await client.documents.findById({ id: doc1Id });
    const verifyDoc2 = await client.documents.findById({ id: doc2Id });
    const verifyDoc3 = await client.documents.findById({ id: doc3Id });

    assert.ok(verifyDoc1.frontMatter.tags.includes("bulk-added-tag"));
    assert.ok(verifyDoc2.frontMatter.tags.includes("bulk-added-tag"));
    assert.ok(verifyDoc3.frontMatter.tags.includes("bulk-added-tag"));

    // Verify original tags are preserved
    assert.ok(verifyDoc1.frontMatter.tags.includes("existing-tag"));
    assert.ok(verifyDoc2.frontMatter.tags.includes("another-tag"));
  });
});

describe("bulk remove_tag operation", () => {
  test("removes tag from selected documents and preserves other tags", async () => {
    const documentIds = [doc1Id, doc2Id];

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
    const updatedDoc1 = await client.documents.findById({ id: doc1Id });
    const updatedDoc2 = await client.documents.findById({ id: doc2Id });

    assert.ok(!updatedDoc1.frontMatter.tags.includes("existing-tag"));
    assert.ok(!updatedDoc2.frontMatter.tags.includes("existing-tag"));

    // Verify other tags are preserved
    assert.ok(updatedDoc1.frontMatter.tags.includes("bulk-added-tag"));
    assert.ok(updatedDoc2.frontMatter.tags.includes("another-tag"));
  });
});

describe("bulk change_journal operation", () => {
  test("moves selected documents to new journal and leaves others unchanged", async () => {
    // Create second journal
    await client.journals.create({ name: "new-journal" });

    const documentIds = [doc1Id, doc2Id];

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
    const movedDoc1 = await client.documents.findById({ id: doc1Id });
    const movedDoc2 = await client.documents.findById({ id: doc2Id });

    assert.strictEqual(movedDoc1.journal, "new-journal");
    assert.strictEqual(movedDoc2.journal, "new-journal");

    // Verify Document 3 is still in original journal
    const stillDoc3 = await client.documents.findById({ id: doc3Id });
    assert.strictEqual(stillDoc3.journal, "test-journal");
  });
});

describe("list operations", () => {
  test("returns completed operations ordered by creation date descending", async () => {
    const operations = await client.bulkOperations.list();

    // Should have at least 3 operations from previous tests
    assert.ok(operations.length >= 3);

    // All should be completed
    for (const op of operations) {
      assert.strictEqual(op.status, "completed");
    }
  });
});

describe("error handling", () => {
  test("throws if search returns no documents", async () => {
    await assert.rejects(
      client.bulkOperations.create({
        type: "add_tag",
        search: { ids: ["invalid-doc-id"] },
        params: { tag: "test-tag" },
      }),
      /No documents provided for bulk operation/,
    );
  });

  test("throws validation error when tag parameter is missing for add_tag", async () => {
    await assert.rejects(
      client.bulkOperations.create({
        type: "add_tag",
        search: { ids: [doc3Id] },
        params: {},
      }),
      /Operation add_tag requires 'tag' parameter/,
    );
  });

  test("throws validation error when tag parameter is missing for remove_tag", async () => {
    await assert.rejects(
      client.bulkOperations.create({
        type: "remove_tag",
        search: { ids: [doc3Id] },
        params: {},
      }),
      /Operation remove_tag requires 'tag' parameter/,
    );
  });

  test("throws validation error when journal parameter is missing for change_journal", async () => {
    await assert.rejects(
      client.bulkOperations.create({
        type: "change_journal",
        search: { ids: [doc3Id] },
        params: {},
      }),
      /Operation change_journal requires 'journal' parameter/,
    );
  });
});
