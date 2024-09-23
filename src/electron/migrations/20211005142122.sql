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
    "content" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    FOREIGN KEY ("journal") REFERENCES "journals" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "document_tags" (
    "documentId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("documentId", "tag")
);


CREATE INDEX IF NOT EXISTS "documents_title_idx" ON "documents"("title");
CREATE INDEX IF NOT EXISTS "documents_createdat_idx" ON "documents"("createdAt");
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "document_tags"("tag");