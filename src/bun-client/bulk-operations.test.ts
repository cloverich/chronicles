import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

// IDs of docs created in the first test, used across tests
let doc1Id: string;
let doc2Id: string;
let doc3Id: string;

beforeAll(async () => {
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

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("bulk add_tag operation", () => {
  test("adds tag to all matching documents and preserves existing tags", async () => {
    const search = { journals: ["test-journal"] };

    // Verify search finds 3 documents
    const docs = await client.documents.search(search);
    expect(docs.data.length).toBe(3);

    // Create bulk operation
    const operationId = await client.bulkOperations.create({
      type: "add_tag",
      search,
      params: { tag: "bulk-added-tag" },
    });

    expect(operationId).toBeTruthy();

    // Verify operation was created in pending state
    const operation = await client.bulkOperations.get(operationId);
    expect(operation.operation.type).toBe("add_tag");
    expect(operation.operation.status).toBe("pending");
    expect(operation.operation.totalItems).toBe(3);
    expect(operation.items.length).toBe(3);

    // Process the operation
    await client.bulkOperations.process(operationId);

    // Verify operation completed successfully
    const completedOp = await client.bulkOperations.get(operationId);
    expect(completedOp.operation.status).toBe("completed");
    expect(completedOp.operation.successCount).toBe(3);
    expect(completedOp.operation.errorCount).toBe(0);

    // Verify all items succeeded
    for (const item of completedOp.items) {
      expect(item.status).toBe("success");
    }

    // Verify tags were added to documents
    const verifyDoc1 = await client.documents.findById({ id: doc1Id });
    const verifyDoc2 = await client.documents.findById({ id: doc2Id });
    const verifyDoc3 = await client.documents.findById({ id: doc3Id });

    expect(verifyDoc1.frontMatter.tags).toContain("bulk-added-tag");
    expect(verifyDoc2.frontMatter.tags).toContain("bulk-added-tag");
    expect(verifyDoc3.frontMatter.tags).toContain("bulk-added-tag");

    // Verify original tags are preserved
    expect(verifyDoc1.frontMatter.tags).toContain("existing-tag");
    expect(verifyDoc2.frontMatter.tags).toContain("another-tag");
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
    expect(completedOp.operation.status).toBe("completed");
    expect(completedOp.operation.successCount).toBe(2);
    expect(completedOp.operation.errorCount).toBe(0);

    // Verify tag was removed
    const updatedDoc1 = await client.documents.findById({ id: doc1Id });
    const updatedDoc2 = await client.documents.findById({ id: doc2Id });

    expect(updatedDoc1.frontMatter.tags).not.toContain("existing-tag");
    expect(updatedDoc2.frontMatter.tags).not.toContain("existing-tag");

    // Verify other tags are preserved
    expect(updatedDoc1.frontMatter.tags).toContain("bulk-added-tag");
    expect(updatedDoc2.frontMatter.tags).toContain("another-tag");
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
    expect(completedOp.operation.status).toBe("completed");
    expect(completedOp.operation.successCount).toBe(2);
    expect(completedOp.operation.errorCount).toBe(0);

    // Verify documents moved to new journal
    const movedDoc1 = await client.documents.findById({ id: doc1Id });
    const movedDoc2 = await client.documents.findById({ id: doc2Id });

    expect(movedDoc1.journal).toBe("new-journal");
    expect(movedDoc2.journal).toBe("new-journal");

    // Verify Document 3 is still in original journal
    const stillDoc3 = await client.documents.findById({ id: doc3Id });
    expect(stillDoc3.journal).toBe("test-journal");
  });
});

describe("list operations", () => {
  test("returns completed operations ordered by creation date descending", async () => {
    const operations = await client.bulkOperations.list();

    // Should have at least 3 operations from previous tests
    expect(operations.length).toBeGreaterThanOrEqual(3);

    // All should be completed
    for (const op of operations) {
      expect(op.status).toBe("completed");
    }
  });
});

describe("error handling", () => {
  test("throws if search returns no documents", async () => {
    await expect(
      client.bulkOperations.create({
        type: "add_tag",
        search: { ids: ["invalid-doc-id"] },
        params: { tag: "test-tag" },
      }),
    ).rejects.toThrow("No documents provided for bulk operation");
  });

  test("throws validation error when tag parameter is missing for add_tag", async () => {
    await expect(
      client.bulkOperations.create({
        type: "add_tag",
        search: { ids: [doc3Id] },
        params: {},
      }),
    ).rejects.toThrow("Operation add_tag requires 'tag' parameter");
  });

  test("throws validation error when tag parameter is missing for remove_tag", async () => {
    await expect(
      client.bulkOperations.create({
        type: "remove_tag",
        search: { ids: [doc3Id] },
        params: {},
      }),
    ).rejects.toThrow("Operation remove_tag requires 'tag' parameter");
  });

  test("throws validation error when journal parameter is missing for change_journal", async () => {
    await expect(
      client.bulkOperations.create({
        type: "change_journal",
        search: { ids: [doc3Id] },
        params: {},
      }),
    ).rejects.toThrow("Operation change_journal requires 'journal' parameter");
  });
});
