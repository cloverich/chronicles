-- CreateTable
CREATE TABLE "nodes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journal" TEXT,
    "date" TEXT,
    "idx" INTEGER,
    "type" TEXT,
    "contents" TEXT,
    "attributes" TEXT
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    FOREIGN KEY ("journalId") REFERENCES "journals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "journals_name_uniq" ON "journals"("name");

-- CreateIndex
CREATE INDEX "documents_title_idx" ON "documents"("title");

-- CreateIndex
CREATE INDEX "documents_createdat_idx" ON "documents"("createdAt");
