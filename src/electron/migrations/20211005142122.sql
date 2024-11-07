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
    "sourcePathResolved" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT "pending",
    "chroniclesId" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "error" TEXT
);

-- First, Import Items table
CREATE TABLE IF NOT EXISTS "import_notes" (
    "importerId" TEXT NOT NULL,
    "status" TEXT NOT NULL, -- success, error
    "chroniclesId" TEXT NOT NULL,
    "chroniclesPath" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "error" BOOLEAN,
    "title" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    "frontMatter" TEXT,
    "content" TEXT
);
