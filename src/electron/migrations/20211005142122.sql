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
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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
    "journalId" TEXT NOT NULL,
    FOREIGN KEY ("journalId") REFERENCES "journals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX  IF NOT EXISTS "journals_name_uniq" ON "journals"("name");

-- CreateIndex
CREATE INDEX  IF NOT EXISTS "documents_title_idx" ON "documents"("title");

-- CreateIndex
CREATE INDEX  IF NOT EXISTS "documents_createdat_idx" ON "documents"("createdAt");
