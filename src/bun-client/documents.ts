import crypto from "crypto";
import fs from "fs";
import path from "path";
import yaml from "yaml";

import {
  and,
  eq,
  inArray,
  like,
  lt,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import { mdastToString, parseMarkdown } from "../markdown";
import { splitFrontMatter } from "../preload/client/importer/frontmatter";
import type {
  CreateRequest,
  FrontMatter,
  GetDocumentResponse,
  IndexRequest,
  SearchItem,
  SearchRequest,
  SearchResponse,
  UpdateRequest,
} from "../preload/client/types";
import { createId } from "../preload/client/util";
import type { BunFilesClient } from "./files";
import * as schema from "./schema";
import { documents, documentTags } from "./schema";

export interface DocSyncMeta {
  mtime: number | null;
  size: number | null;
  contentHash: string | null;
}

export type IDocumentsClient = DocumentsClient;

export class DocumentsClient {
  constructor(
    private db: BunSQLiteDatabase<typeof schema>,
    private files: BunFilesClient,
    private notesDir: string,
  ) {}

  /**
   * Parse raw document content (YAML frontmatter + body) without a full mdast pass.
   * Sufficient for Phase 4 CRUD operations. Phase 5 (FTS) introduces mdast parsing.
   */
  private parseDocument(rawContent: string): {
    frontMatter: FrontMatter;
    body: string;
  } {
    const now = new Date().toISOString();
    const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      const fm: Record<string, any> = yaml.parse(fmMatch[1]) || {};
      const body = fmMatch[2].trim();
      return {
        frontMatter: {
          tags: fm.tags || [],
          title: fm.title,
          createdAt: fm.createdAt || now,
          updatedAt: fm.updatedAt || now,
          ...fm,
        },
        body,
      };
    }
    return {
      frontMatter: {
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
      body: rawContent.trim(),
    };
  }

  private prependFrontMatter(
    content: string,
    frontMatter: Record<string, any>,
  ): string {
    const fm = ["---", yaml.stringify(frontMatter), "---"].join("\n");
    return `${fm}\n\n${content}`;
  }

  private beforeTokenFormat(input: string): "date" | "id" | "unknown" {
    const dateRegex = /^(?:\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
    const idRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (dateRegex.test(input)) return "date";
    if (idRegex.test(input)) return "id";
    return "unknown";
  }

  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async computeSyncMeta(filePath: string, content: string) {
    const stats = await fs.promises.stat(filePath);
    return {
      mtime: Math.floor(stats.mtimeMs),
      size: stats.size,
      contentHash: this.computeHash(content),
    };
  }

  findById = async ({ id }: { id: string }): Promise<GetDocumentResponse> => {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    if (!row) {
      throw new Error(`[DOCUMENT_NOT_FOUND] Document ${id} not found`);
    }

    const filepath = path.join(this.notesDir, row.journal, `${id}.md`);
    const rawContent = await this.files.readDocument(filepath);
    const { frontMatter, body } = this.parseDocument(rawContent);

    frontMatter.createdAt = frontMatter.createdAt || row.createdAt;
    frontMatter.updatedAt = frontMatter.updatedAt || row.updatedAt;

    return {
      id: row.id,
      journal: row.journal,
      frontMatter,
      content: body,
    };
  };

  createDocument = async (args: CreateRequest): Promise<[string, string]> => {
    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    args.frontMatter.createdAt =
      args.frontMatter.createdAt || new Date().toISOString();
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const id = args.id || createId(Date.parse(args.frontMatter.createdAt));
    const content = this.prependFrontMatter(args.content, args.frontMatter);
    const docPath = await this.files.uploadDocument(
      { id, content },
      args.journal,
    );

    const syncMeta = await this.computeSyncMeta(docPath, content);

    await this.db.transaction(async (trx) => {
      await trx.insert(documents).values({
        id,
        journal: args.journal,
        title: args.frontMatter.title,
        createdAt: args.frontMatter.createdAt,
        updatedAt: args.frontMatter.updatedAt,
        frontmatter: JSON.stringify(args.frontMatter),
        mtime: syncMeta.mtime,
        size: syncMeta.size,
        contentHash: syncMeta.contentHash,
      });

      if (args.frontMatter.tags.length > 0) {
        await trx.insert(documentTags).values(
          args.frontMatter.tags.map((tag: string) => ({
            documentId: id,
            tag,
          })),
        );
      }

      // Index into FTS5 for full-text search
      trx.run(
        sql`INSERT INTO documents_fts (id, title, content) VALUES (${id}, ${args.frontMatter.title || ""}, ${args.content})`,
      );
    });

    return [id, docPath];
  };

  updateDocument = async (args: UpdateRequest): Promise<void> => {
    if (!args.id) throw new Error("id required to update document");

    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const content = this.prependFrontMatter(args.content, args.frontMatter);
    const docPath = await this.files.uploadDocument(
      { id: args.id, content },
      args.journal,
    );

    const syncMeta = await this.computeSyncMeta(docPath, content);

    await this.db.transaction(async (trx) => {
      await trx
        .update(documents)
        .set({
          journal: args.journal,
          title: args.frontMatter.title,
          updatedAt: args.frontMatter.updatedAt,
          frontmatter: JSON.stringify(args.frontMatter),
          mtime: syncMeta.mtime,
          size: syncMeta.size,
          contentHash: syncMeta.contentHash,
        })
        .where(eq(documents.id, args.id));

      await trx
        .delete(documentTags)
        .where(eq(documentTags.documentId, args.id));

      if (args.frontMatter.tags.length > 0) {
        await trx.insert(documentTags).values(
          args.frontMatter.tags.map((tag: string) => ({
            documentId: args.id,
            tag,
          })),
        );
      }

      // Update FTS index (delete + re-insert; FTS5 doesn't support UPDATE well)
      trx.run(sql`DELETE FROM documents_fts WHERE id = ${args.id}`);
      trx.run(
        sql`INSERT INTO documents_fts (id, title, content) VALUES (${args.id}, ${args.frontMatter.title || ""}, ${args.content})`,
      );
    });
  };

  del = async (id: string, journal: string): Promise<void> => {
    await this.files.deleteDocument(id, journal);
    await this.db.transaction(async (trx) => {
      await trx.delete(documents).where(eq(documents.id, id));
      trx.run(sql`DELETE FROM documents_fts WHERE id = ${id}`);
    });
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    const conditions: SQL[] = [];

    if (q?.ids?.length) {
      conditions.push(inArray(documents.id, q.ids));
    }

    if (q?.journals?.length) {
      conditions.push(inArray(documents.journal, q.journals));
    }

    if (q?.exclude?.journals?.length) {
      conditions.push(notInArray(documents.journal, q.exclude.journals));
    }

    if (q?.date) {
      conditions.push(like(documents.createdAt, `${q.date}%`));
    }

    if (q?.before) {
      if (this.beforeTokenFormat(q.before) === "date") {
        conditions.push(lt(documents.createdAt, q.before));
      } else {
        conditions.push(lt(documents.id, q.before));
      }
    }

    if (q?.titles?.length) {
      for (const title of q.titles) {
        conditions.push(like(documents.title, `%${title}%`));
      }
    }

    // Tag inclusion: fetch matching doc IDs via subquery
    if (q?.tags?.length) {
      const taggedIds = await this.db
        .selectDistinct({ documentId: documentTags.documentId })
        .from(documentTags)
        .where(inArray(documentTags.tag, q.tags));
      const ids = taggedIds.map((r) => r.documentId);
      if (ids.length === 0) return { data: [] };
      conditions.push(inArray(documents.id, ids));
    }

    // Tag exclusion: exclude doc IDs that have any of the excluded tags
    if (q?.exclude?.tags?.length) {
      const excludedIds = await this.db
        .selectDistinct({ documentId: documentTags.documentId })
        .from(documentTags)
        .where(inArray(documentTags.tag, q.exclude.tags));
      const ids = excludedIds.map((r) => r.documentId);
      if (ids.length > 0) {
        conditions.push(notInArray(documents.id, ids));
      }
    }

    // FTS5 full-text search: two-query approach because Drizzle doesn't support
    // virtual table JOINs. Feeds matching IDs into IN (...) — note SQLite's
    // default SQLITE_MAX_VARIABLE_NUMBER is 999; fine for typical result sets.
    if (q?.texts?.length) {
      const ftsTerms = q.texts
        .map((t) => `"${t.replace(/"/g, '""')}"`)
        .join(" ");
      const ftsRows = await this.db.all<{ id: string }>(
        sql`SELECT id FROM documents_fts WHERE documents_fts MATCH ${ftsTerms}`,
      );
      const ftsIds = ftsRows.map((r) => r.id);
      if (ftsIds.length === 0) return { data: [] };
      conditions.push(inArray(documents.id, ftsIds));
    }

    const cols = {
      id: documents.id,
      createdAt: documents.createdAt,
      title: documents.title,
      journal: documents.journal,
    };
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    let query = this.db.select(cols).from(documents);
    const filtered = whereClause ? query.where(whereClause) : query;
    const ordered = filtered.orderBy(sql`${documents.createdAt} DESC`);
    const rows = await (q?.limit ? ordered.limit(q.limit) : ordered);

    return { data: rows as SearchItem[] };
  };

  getSyncMeta = async (id: string): Promise<DocSyncMeta> => {
    const [row] = await this.db
      .select({
        mtime: documents.mtime,
        size: documents.size,
        contentHash: documents.contentHash,
      })
      .from(documents)
      .where(eq(documents.id, id));

    if (!row) return { mtime: null, size: null, contentHash: null };
    return {
      mtime: row.mtime ?? null,
      size: row.size ?? null,
      contentHash: row.contentHash ?? null,
    };
  };

  getAllDocSyncMeta = async (): Promise<Map<string, DocSyncMeta>> => {
    const rows = await this.db
      .select({
        id: documents.id,
        mtime: documents.mtime,
        size: documents.size,
        contentHash: documents.contentHash,
      })
      .from(documents);

    const map = new Map<string, DocSyncMeta>();
    for (const row of rows) {
      map.set(row.id, {
        mtime: row.mtime ?? null,
        size: row.size ?? null,
        contentHash: row.contentHash ?? null,
      });
    }
    return map;
  };

  updateDocSyncMeta = async (
    id: string,
    meta: { mtime: number; size: number },
  ): Promise<void> => {
    await this.db.update(documents).set(meta).where(eq(documents.id, id));
  };

  deleteOrphanedDocuments = async (seenIds: Set<string>): Promise<number> => {
    const seenIdsArray = Array.from(seenIds);
    const orphaned = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(
        seenIdsArray.length > 0
          ? notInArray(documents.id, seenIdsArray)
          : sql`1=1`,
      );

    if (orphaned.length > 0) {
      const orphanIds = orphaned.map((d) => d.id);
      await this.db.delete(documents).where(inArray(documents.id, orphanIds));
      this.db.run(
        sql`DELETE FROM documents_fts WHERE id IN (${sql.join(
          orphanIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    return orphaned.length;
  };

  deindexJournal = async (journal: string): Promise<void> => {
    // Bulk-delete FTS entries via subquery before removing documents rows
    this.db.run(
      sql`DELETE FROM documents_fts WHERE id IN (SELECT id FROM documents WHERE journal = ${journal})`,
    );
    await this.db.delete(documents).where(eq(documents.journal, journal));
  };

  /**
   * Read raw document contents from disk and compute content hash.
   * Used by the indexer for incremental sync (hash comparison).
   */
  readDocRaw = async (filePath: string) => {
    const rawContents = await this.files.readDocument(filePath);
    const contentHash = this.computeHash(rawContents);
    return { rawContents, contentHash };
  };

  /**
   * Parse raw markdown contents into mdast body + frontMatter.
   * Uses micromark → mdast → splitFrontMatter pipeline.
   */
  parseDoc = (rawContents: string, stats: fs.Stats) => {
    const mdast = parseMarkdown(rawContents);
    const { frontMatter, bodyMdast } = splitFrontMatter(mdast, stats);
    return { mdast: bodyMdast, frontMatter };
  };

  /**
   * Create or update a document index entry from a parsed mdast tree.
   * This is the "slow path" used by the indexer after parsing a changed file.
   * Handles documents table, tags, FTS5, in a single transaction.
   */
  createIndex = async ({
    id,
    journal,
    mdast,
    frontMatter,
    syncMeta,
  }: IndexRequest): Promise<string> => {
    if (!id) throw new Error("id required to create document index");

    const content = mdastToString(mdast);
    const title = frontMatter.title || "";

    await this.db.transaction(async (trx) => {
      // Check if document already exists
      const [existing] = await trx
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, id));

      if (existing) {
        await trx
          .update(documents)
          .set({
            journal,
            title: frontMatter.title,
            updatedAt: frontMatter.updatedAt,
            frontmatter: JSON.stringify(frontMatter),
            ...(syncMeta && {
              mtime: syncMeta.mtime,
              size: syncMeta.size,
              contentHash: syncMeta.contentHash,
            }),
          })
          .where(eq(documents.id, id));
      } else {
        await trx.insert(documents).values({
          id,
          journal,
          title: frontMatter.title,
          createdAt: frontMatter.createdAt,
          updatedAt: frontMatter.updatedAt,
          frontmatter: JSON.stringify(frontMatter),
          ...(syncMeta && {
            mtime: syncMeta.mtime,
            size: syncMeta.size,
            contentHash: syncMeta.contentHash,
          }),
        });
      }

      // Clear and re-insert tags
      await trx.delete(documentTags).where(eq(documentTags.documentId, id));
      if (frontMatter.tags.length > 0) {
        await trx
          .insert(documentTags)
          .values(
            frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
          );
      }

      // Update FTS index (delete + re-insert)
      trx.run(sql`DELETE FROM documents_fts WHERE id = ${id}`);
      trx.run(
        sql`INSERT INTO documents_fts (id, title, content) VALUES (${id}, ${title}, ${content})`,
      );
    });

    return id;
  };
}
