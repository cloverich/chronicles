# Bulk note editing

Bulk operations allow you to to update the tags or journal of a group of notes; the goal is to support re-organizing your notes as your collection grows. Additionally, the system provides an audit trail for debugging and potential manual recovery (requires accessing the sqlite database).

## Basic Usage

Initiate bulk operations using cmd+k on the search documents page. This will present you with a series of menus for modifying the documents matched in your current search. The general flow is thus:

1. Update search filters until you get the sub-set of documents you want to update.
2. cmd+k to run through the prompts
3. The notification system will alert you when the operation completes

## Architecture

The bulk operations system consists of:

- **Database Tables**: `bulk_operations` and `bulk_operation_items` track operations and individual document changes
- **Backend Client**: `BulkOperationsClient` in `src/preload/client/bulk-operations.ts` handles creation and processing
- **Frontned Store**: The UI utilizes the bulk operations client through the `BulkOperationsStore`, to ensure actions are observable
- **Audit Trail**: All operations and their results are persisted in the database for debugging

### Database Schema

**bulk_operations** - Tracks each bulk operation

```sql
CREATE TABLE "bulk_operations" (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL,                        -- 'add_tag', 'remove_tag', 'change_journal'
    "search" TEXT NOT NULL,                      -- JSON: SearchRequest used to find documents
    "params" TEXT NOT NULL,                      -- JSON: { tag: "mytag" } or { journal: "new-journal" }
    "status" TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'running', 'completed', 'failed'
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "documentId" TEXT NOT NULL,                  -- Not a foreign key - allows tracking deleted documents
    "status" TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'success', 'error'
    "error" TEXT,                                -- Error message if failed
    "processedAt" TEXT,
    PRIMARY KEY ("operationId", "documentId"),
    FOREIGN KEY ("operationId") REFERENCES "bulk_operations" ("id") ON DELETE CASCADE
);
```

### Processing Flow

1. **Create Operation**: Accepts a search request and operation parameters

   - Executes the search to find matching documents
   - Validates operation type and required parameters
   - Creates operation record and items in a transaction
   - Returns operation ID

2. **Process Operation**: Iterates through pending items

   - Marks operation as 'running'
   - Uses `documents.updateDocument()` for each item (ensures consistency with single-document edits)
   - Records success/error status for each item
   - Updates operation success/error counts
   - Marks operation as 'completed'

3. **Query Operations**: Use `list()` or `get(operationId)` to inspect operations and their items

### Supported Operations

- **Add Tag** (`add_tag`): Adds a tag to documents without removing existing tags
- **Remove Tag** (`remove_tag`): Removes a tag from documents, preserving other tags
- **Change Journal** (`change_journal`): Moves documents to a different journal

### Manual Recovery & Debugging

All operations are persisted in the database. You can query them directly using SQL for debugging or manual recovery. You'd need to use the combination of the original search (in bulk operations) and the operation+params (e.g. "add_tag" and "tag: foo_tag") to undo; not currently supported in the API but feasible as far as the data goes.
