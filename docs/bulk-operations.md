# Bulk Operations

Bulk operations allow you to perform actions on multiple documents at once, such as adding/removing tags or changing journals. The system provides an audit trail for debugging and potential manual recovery.

## Overview

The bulk operations system consists of:

- **Database Tables**: `bulk_operations` and `bulk_operation_items` track operations and individual document changes
- **Backend Client**: `BulkOperationsClient` in `src/preload/client/bulk-operations.ts` handles creation and processing
- **Audit Trail**: All operations and their results are persisted in the database for debugging

## Architecture

### Database Schema

**bulk_operations** - Tracks each bulk operation

```sql
CREATE TABLE "bulk_operations" (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL,           -- 'add_tag', 'remove_tag', 'change_journal'
    "search" TEXT NOT NULL,         -- SearchRequest
    "params" TEXT NOT NULL,         -- JSON: { tag: "mytag" } or { journal: "new-journal" }
    "status" TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "totalItems" INTEGER NOT NULL,
    "successCount" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0
);
```

**bulk_operation_items** - Tracks each document in an operation

```sql
CREATE TABLE "bulk_operation_items" (
    "operationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL, -- Not a foreign key - allows tracking operations on invalid/deleted documents
    "status" TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
    "error" TEXT,                    -- Error message if failed
    "processedAt" TEXT,
    PRIMARY KEY ("operationId", "documentId"),
    FOREIGN KEY ("operationId") REFERENCES "bulk_operations" ("id") ON DELETE CASCADE
);
```

### Processing Flow

1. **Create Operation**: Call `client.bulkOperations.create()` with operation type, document IDs, and parameters

   - Validates operation type and required parameters
   - Creates operation record and items in a transaction
   - Returns operation ID

2. **Process Operation**: Call `client.bulkOperations.process(operationId)`

   - Marks operation as 'running'
   - Iterates through pending items
   - Uses existing `documents.updateDocument()` for each item (ensures consistency with single-document operations)
   - Records success/error status for each item
   - Updates operation success/error counts
   - Marks operation as 'completed'

3. **Query Operations**: Use `client.bulkOperations.list()` or `client.bulkOperations.get(operationId)` to inspect operations

## Supported Operations

### Add Tag

Adds a tag to multiple documents without removing existing tags.

```typescript
const operationId = await client.bulkOperations.create({
  type: "add_tag",
  documentIds: ["doc-id-1", "doc-id-2"],
  params: { tag: "my-tag" },
});

await client.bulkOperations.process(operationId);
```

### Remove Tag

Removes a tag from multiple documents, preserving other tags.

```typescript
const operationId = await client.bulkOperations.create({
  type: "remove_tag",
  documentIds: ["doc-id-1", "doc-id-2"],
  params: { tag: "unwanted-tag" },
});

await client.bulkOperations.process(operationId);
```

### Change Journal

Moves multiple documents to a different journal.

```typescript
const operationId = await client.bulkOperations.create({
  type: "change_journal",
  documentIds: ["doc-id-1", "doc-id-2"],
  params: { journal: "new-journal" },
});

await client.bulkOperations.process(operationId);
```

## Usage Example

```typescript
// 1. Search for documents to update
const searchResults = await client.documents.search({
  journals: ["my-journal"],
  tags: ["needs-review"],
});

const documentIds = searchResults.data.map((doc) => doc.id);

// 2. Create bulk operation
const operationId = await client.bulkOperations.create({
  type: "add_tag",
  documentIds,
  params: { tag: "reviewed" },
});

// 3. Process the operation
await client.bulkOperations.process(operationId);

// 4. Check results
const result = await client.bulkOperations.get(operationId);
console.log(
  `Completed: ${result.operation.successCount} succeeded, ${result.operation.errorCount} failed`,
);

// 5. Inspect failures if any
const failedItems = result.items.filter((item) => item.status === "error");
failedItems.forEach((item) => {
  console.log(`Document ${item.documentId} failed: ${item.error}`);
});
```

## Manual Recovery & Debugging

All operations are persisted in the database. You can query them directly using SQL for debugging or manual recovery.

### Query All Operations

```sql
-- List all operations with summary
SELECT
  id,
  type,
  status,
  totalItems,
  successCount,
  errorCount,
  createdAt,
  completedAt
FROM bulk_operations
ORDER BY createdAt DESC;
```

### Query Operation Details

```sql
-- Get details for a specific operation
SELECT * FROM bulk_operations
WHERE id = 'operation-id';

-- Get all items for an operation
SELECT * FROM bulk_operation_items
WHERE operationId = 'operation-id';
```

### Find Failed Items

```sql
-- Find all failed items across operations
SELECT
  bo.type,
  bo.params,
  boi.documentId,
  boi.error,
  boi.processedAt
FROM bulk_operation_items boi
JOIN bulk_operations bo ON boi.operationId = bo.id
WHERE boi.status = 'error'
ORDER BY boi.processedAt DESC;
```

### Retry Failed Items Manually

If items fail, you can manually retry them using the documents API:

```typescript
// Get failed operation details
const operation = await client.bulkOperations.get("operation-id");
const failedItems = operation.items.filter((item) => item.status === "error");

// Manually retry each failed item
for (const item of failedItems) {
  try {
    const doc = await client.documents.findById({ id: item.documentId });

    // For add_tag operation:
    const params = JSON.parse(operation.operation.params);
    const tags = new Set(doc.frontMatter.tags);
    tags.add(params.tag);

    await client.documents.updateDocument({
      id: doc.id,
      journal: doc.journal,
      content: doc.content,
      frontMatter: {
        ...doc.frontMatter,
        tags: Array.from(tags),
      },
    });
  } catch (error) {
    console.error(`Failed to retry ${item.documentId}:`, error);
  }
}
```

### Clean Up Old Operations

Operations accumulate in the database. You can periodically clean up old completed operations:

```sql
-- Delete operations older than 30 days
DELETE FROM bulk_operations
WHERE status = 'completed'
  AND datetime(completedAt) < datetime('now', '-30 days');

-- Items will be cascade deleted automatically
```

## Implementation Details

### Reusing Existing Code

The bulk operations system intentionally reuses `documents.updateDocument()` for each item rather than performing direct SQL updates. This ensures:

- Markdown files are updated on disk
- Dependent document links are updated
- Frontmatter is properly serialized
- All database tables (documents, document_tags, document_links) stay in sync
- Behavior matches single-document operations

### Transaction Safety

- Creating an operation (with all items) is atomic - wrapped in a Knex transaction
- Processing items is NOT wrapped in a single transaction - each document update is its own transaction
- This allows partial success: some items can succeed while others fail
- The audit trail records exactly which items succeeded/failed

### Future Optimizations

For very large operations, the iterative approach may be slow. Potential optimizations:

1. **Batch Updates**: Process items in batches of 10-50
2. **Direct SQL**: For simple tag operations, skip `updateDocument()` and use direct SQL (trade-off: must manually update markdown files and dependent links)
3. **Background Processing**: Queue operations to run in background
4. **Progress Callbacks**: Add callback/event system for UI progress updates

## Testing

Tests are in `src/preload/client/bulk-operations.electron-test.ts`. Run with:

```bash
yarn test:electron:bulk-operations
```

Tests cover:

- Creating operations
- Processing operations
- All operation types (add_tag, remove_tag, change_journal)
- Error handling (invalid document IDs)
- Validation (missing parameters, empty document list)
- Database schema verification
