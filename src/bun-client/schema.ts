import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// ---------- journals ----------
export const journals = sqliteTable("journals", {
  name: text("name").primaryKey().notNull(),
  createdAt: text("createdAt")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text("archivedAt"),
});

// ---------- documents ----------
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey().notNull(),
    createdAt: text("createdAt")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updatedAt")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    title: text("title"),
    journal: text("journal")
      .notNull()
      .references(() => journals.name, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    frontmatter: text("frontmatter").notNull(),
    // Incremental sync columns (migration 2)
    mtime: integer("mtime"),
    size: integer("size"),
    contentHash: text("contentHash"),
  },
  (table) => [
    index("documents_title_idx").on(table.title),
    index("documents_createdat_idx").on(table.createdAt),
  ],
);

// ---------- document_tags ----------
export const documentTags = sqliteTable(
  "document_tags",
  {
    documentId: text("documentId")
      .notNull()
      .references(() => documents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tag: text("tag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.tag] }),
    index("tags_name_idx").on(table.tag),
  ],
);

// ---------- document_links ----------
export const documentLinks = sqliteTable(
  "document_links",
  {
    documentId: text("documentId")
      .notNull()
      .references(() => documents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetId: text("targetId").notNull(),
    targetJournal: text("targetJournal").notNull(),
    resolvedAt: text("resolvedAt"),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.targetId] }),
    index("document_links_target_idx").on(table.targetId),
  ],
);

// ---------- image_links ----------
export const imageLinks = sqliteTable(
  "image_links",
  {
    documentId: text("documentId")
      .notNull()
      .references(() => documents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    imagePath: text("imagePath").notNull(),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    lastChecked: text("lastChecked")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.imagePath] }),
    index("image_links_path_idx").on(table.imagePath),
    index("image_links_resolved_idx").on(table.resolved),
  ],
);

// ---------- sync ----------
export const sync = sqliteTable("sync", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("startedAt")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completedAt"),
  syncedCount: integer("syncedCount"),
  errorCount: integer("errorCount"),
  durationMs: integer("durationMs"),
});

// ---------- imports ----------
export const imports = sqliteTable("imports", {
  id: text("id").primaryKey().notNull(),
  importDir: text("importDir").notNull(),
  createdAt: text("createdAt")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  status: text("status").notNull(), // active, inactive
});

// ---------- import_files ----------
export const importFiles = sqliteTable("import_files", {
  importerId: text("importerId").notNull(),
  status: text("status").notNull().default("pending"),
  chroniclesId: text("chroniclesId").notNull(),
  sourcePathResolved: text("sourcePathResolved").primaryKey().notNull(),
  filename: text("filename").notNull(),
  extension: text("extension").notNull(),
  error: text("error"),
});

// ---------- import_notes ----------
export const importNotes = sqliteTable("import_notes", {
  importerId: text("importerId").notNull(),
  status: text("status").notNull(),
  chroniclesId: text("chroniclesId").notNull(),
  chroniclesPath: text("chroniclesPath").notNull(),
  sourcePath: text("sourcePath").primaryKey().notNull(),
  sourceId: text("sourceId"),
  error: integer("error", { mode: "boolean" }),
  journal: text("journal").notNull(),
  frontMatter: text("frontMatter"),
  content: text("content"),
});

// ---------- bulk_operations ----------
export const bulkOperations = sqliteTable(
  "bulk_operations",
  {
    id: text("id").primaryKey().notNull(),
    type: text("type").notNull(),
    search: text("search").notNull(),
    params: text("params").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("createdAt")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    startedAt: text("startedAt"),
    completedAt: text("completedAt"),
    totalItems: integer("totalItems").notNull(),
    successCount: integer("successCount").default(0),
    errorCount: integer("errorCount").default(0),
  },
  (table) => [index("bulk_operations_status_idx").on(table.status)],
);

// ---------- bulk_operation_items ----------
export const bulkOperationItems = sqliteTable(
  "bulk_operation_items",
  {
    operationId: text("operationId")
      .notNull()
      .references(() => bulkOperations.id, { onDelete: "cascade" }),
    documentId: text("documentId").notNull(),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    processedAt: text("processedAt"),
  },
  (table) => [
    primaryKey({ columns: [table.operationId, table.documentId] }),
    index("bulk_operation_items_status_idx").on(table.status),
  ],
);

// ---------- nodes (legacy) ----------
export const nodes = sqliteTable("nodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journal: text("journal"),
  date: text("date"),
  idx: integer("idx"),
  type: text("type"),
  contents: text("contents"),
  attributes: text("attributes"),
});
