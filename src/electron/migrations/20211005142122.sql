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

-- IMPORTS

-- In development, drop the import tables
DROP TABLE IF EXISTS "import_items";
DROP TABLE IF EXISTS "import_links";

-- First, Import Items table
CREATE TABLE IF NOT EXISTS "import_items" (
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

CREATE TABLE IF NOT EXISTS "import_links" (
    "importerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL, -- link, file
    "sourceChroniclesId" TEXT NOT NULL, -- chroniclesId of file that owns the link
    "sourceChroniclesPath" TEXT NOT NULL, -- chroniclesPath of file that owns the linkwhere
    "sourceId" TEXT NOT NULL, -- notionId of document this link is in
    "sourceUrl" TEXT NOT NULL, -- the original url of the link
    "sourceUrlResolveable" BOOLEAN NOT NULL,
    "sourceUrlResolved" TEXT NOT NULL, -- chroniclesId -- do we need this?
    "destChroniclesId" TEXT, -- (eventual) chroniclesId of file that owns the link
    "title" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    PRIMARY KEY ("sourceChroniclesId", "sourceId") -- not thought out... this is source document ids (importItemId, sourceId).
);
