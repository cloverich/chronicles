-- CreateTable
CREATE TABLE IF NOT EXISTS "nodes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journal" TEXT,
    "date" TEXT,
    "idx" INTEGER,
    "type" TEXT,
    "contents" TEXT,
    "attributes" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "journals" (
    "name" TEXT NOT NULL PRIMARY KEY,
    -- TODO: These defaults need to use timezone (same for documents)
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TEXT
);

-- CreateTable
CREATE TABLE  IF NOT EXISTS "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "journal" TEXT NOT NULL,
    "frontmatter" TEXT NOT NULL,
    FOREIGN KEY ("journal") REFERENCES "journals" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "document_tags" (
    "documentId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("documentId", "tag")
);

CREATE TABLE IF NOT EXISTS "document_links" (
    "documentId" TEXT NOT NULL,
    -- tagetId is not a foreign key, because if we delete the document, we leave
    -- orphaned links in the original (would be weird to remove markdown links in the dependent notes)
    "targetId" TEXT NOT NULL,
    "targetJournal" TEXT NOT NULL,
    "resolvedAt" TEXT,
    FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("documentId", "targetId")
);

CREATE TABLE IF NOT EXISTS "image_links" (
    "documentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT 0,
    "lastChecked" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("documentId", "imagePath")
);

CREATE TABLE IF NOT EXISTS "sync" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "startedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TEXT,
    "syncedCount" INTEGER,
    "errorCount" INTEGER,
    "durationMs" INTEGER
);

CREATE INDEX IF NOT EXISTS "document_links_target_idx" ON "document_links"("targetId");
CREATE INDEX IF NOT EXISTS "documents_title_idx" ON "documents"("title");
CREATE INDEX IF NOT EXISTS "documents_createdat_idx" ON "documents"("createdAt");
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "document_tags"("tag");
CREATE INDEX IF NOT EXISTS "image_links_path_idx" ON "image_links"("imagePath");
CREATE INDEX IF NOT EXISTS "image_links_resolved_idx" ON "image_links"("resolved");


-- DROP TABLE IF EXISTS "imports";
-- DROP TABLE IF EXISTS "import_notes";
-- DROP TABLE IF EXISTS "import_files";

CREATE TABLE IF NOT EXISTS "imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importDir" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL -- active, inactive
);

CREATE TABLE IF NOT EXISTS "import_files" (
    "importerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT "pending",
    "chroniclesId" TEXT NOT NULL,
    "sourcePathResolved" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL, -- filename without extension
    "extension" TEXT NOT NULL,
    "error" TEXT
);

CREATE TABLE IF NOT EXISTS "import_notes" (
    "importerId" TEXT NOT NULL,
    "status" TEXT NOT NULL, -- success, error
    "chroniclesId" TEXT NOT NULL,
    "chroniclesPath" TEXT NOT NULL,
    -- todo: sourcePath + hash of content
    "sourcePath" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "error" BOOLEAN,
    "journal" TEXT NOT NULL,
    "frontMatter" TEXT,
    "content" TEXT
);

-- Bulk operations support
CREATE TABLE IF NOT EXISTS "bulk_operations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL, -- 'add_tag', 'remove_tag', 'change_journal'
    "search" TEXT NOT NULL, -- Search request used to find notes to operate on
    "params" TEXT NOT NULL, -- JSON: { tag: "mytag" } or { journal: "new-journal" }
    "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "totalItems" INTEGER NOT NULL,
    "successCount" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "bulk_operation_items" (
    "operationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL, -- Not a foreign key - allows tracking operations on invalid/deleted documents
    "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'error'
    "error" TEXT,
    "processedAt" TEXT,
    FOREIGN KEY ("operationId") REFERENCES "bulk_operations" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("operationId", "documentId")
);

CREATE INDEX IF NOT EXISTS "bulk_operation_items_status_idx" ON "bulk_operation_items"("status");
CREATE INDEX IF NOT EXISTS "bulk_operations_status_idx" ON "bulk_operations"("status");
