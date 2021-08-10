-- CreateTable
CREATE TABLE "documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journal" TEXT,
    "date" TEXT,
    "title" TEXT,
    "contents" TEXT
);

-- CreateTable
CREATE TABLE "journals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'day'
);

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

-- CreateIndex
CREATE INDEX "documents_titles_idx" ON "documents"("title");

-- CreateIndex
CREATE UNIQUE INDEX "documents_journal_date_title_uniq" ON "documents"("journal", "date", "title");
