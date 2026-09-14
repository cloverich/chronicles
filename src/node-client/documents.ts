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
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type {
  CreateRequest,
  FrontMatter,
  GetDocumentResponse,
  SearchItem,
  SearchRequest,
  SearchResponse,
  UpdateRequest,
} from "../preload/client/types";
import { createId } from "../preload/client/util";
import { derive } from "./derive";
import type { NodeFilesClient } from "./files";
import * as schema from "./schema";
import { documentLinks, documents, documentTags, imageLinks } from "./schema";

export type IDocumentsClient = DocumentsClient;

// Front-matter keys that are canonical columns on `documents` / `documentTags`.
// The `frontmatter` JSON column only holds arbitrary user-supplied keys.
const COLUMN_OWNED_FRONTMATTER_KEYS = [
  "title",
  "tags",
  "createdAt",
  "updatedAt",
] as const;

/** Strip column-owned keys from a FrontMatter object, leaving only user keys. */
function stripColumnOwnedKeys(
  frontMatter: Record<string, any>,
): Record<string, any> {
  const userKeys = { ...frontMatter };
  for (const key of COLUMN_OWNED_FRONTMATTER_KEYS) {
    delete userKeys[key];
  }
  return userKeys;
}

export class DocumentsClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private files: NodeFilesClient,
  ) {}

  private beforeTokenFormat(input: string): "date" | "id" | "unknown" {
    const dateRegex = /^(?:\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
    const idRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (dateRegex.test(input)) return "date";
    if (idRegex.test(input)) return "id";
    return "unknown";
  }

  findById = async ({ id }: { id: string }): Promise<GetDocumentResponse> => {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    if (!row) {
      throw new Error(`[DOCUMENT_NOT_FOUND] Document ${id} not found`);
    }

    const tagRows = await this.db
      .select({ tag: documentTags.tag })
      .from(documentTags)
      .where(eq(documentTags.documentId, id))
      .orderBy(documentTags.tag);
    const tags = tagRows.map((t) => t.tag);

    const userKeys: Record<string, any> = row.frontmatter
      ? JSON.parse(row.frontmatter)
      : {};

    const frontMatter: FrontMatter = {
      ...userKeys,
      title: row.title ?? undefined,
      tags,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return {
      id: row.id,
      journal: row.journal,
      frontMatter,
      content: row.content,
    };
  };

  createDocument = async (args: CreateRequest): Promise<string> => {
    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    args.frontMatter.createdAt =
      args.frontMatter.createdAt || new Date().toISOString();
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const id = args.id || createId(Date.parse(args.frontMatter.createdAt));
    const userKeys = stripColumnOwnedKeys(args.frontMatter);

    this.db.transaction((trx) => {
      trx
        .insert(documents)
        .values({
          id,
          journal: args.journal,
          title: args.frontMatter.title,
          createdAt: args.frontMatter.createdAt,
          updatedAt: args.frontMatter.updatedAt,
          frontmatter: JSON.stringify(userKeys),
          content: args.content,
        })
        .run();

      if (args.frontMatter.tags.length > 0) {
        trx
          .insert(documentTags)
          .values(
            args.frontMatter.tags.map((tag: string) => ({
              documentId: id,
              tag,
            })),
          )
          .run();
      }

      derive(trx, {
        id,
        title: args.frontMatter.title,
        content: args.content,
      });
    });

    return id;
  };

  updateDocument = async (args: UpdateRequest): Promise<void> => {
    if (!args.id) throw new Error("id required to update document");

    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const userKeys = stripColumnOwnedKeys(args.frontMatter);

    this.db.transaction((trx) => {
      const [existing] = trx
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, args.id))
        .all();

      if (!existing) {
        throw new Error(`[DOCUMENT_NOT_FOUND] Document ${args.id} not found`);
      }

      trx
        .update(documents)
        .set({
          journal: args.journal,
          title: args.frontMatter.title,
          updatedAt: args.frontMatter.updatedAt,
          frontmatter: JSON.stringify(userKeys),
          content: args.content,
        })
        .where(eq(documents.id, args.id))
        .run();

      trx
        .delete(documentTags)
        .where(eq(documentTags.documentId, args.id))
        .run();

      if (args.frontMatter.tags.length > 0) {
        trx
          .insert(documentTags)
          .values(
            args.frontMatter.tags.map((tag: string) => ({
              documentId: args.id,
              tag,
            })),
          )
          .run();
      }

      derive(trx, {
        id: args.id,
        title: args.frontMatter.title,
        content: args.content,
      });
    });
  };

  del = async (id: string): Promise<void> => {
    this.db.transaction((trx) => {
      trx.delete(documents).where(eq(documents.id, id)).run();
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

  /**
   * Count matching documents (same filters as search, minus pagination).
   * Used by the UI for "N results" display.
   */
  searchCount = async (q?: SearchRequest): Promise<number> => {
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
    if (q?.titles?.length) {
      for (const title of q.titles) {
        conditions.push(like(documents.title, `%${title}%`));
      }
    }
    if (q?.tags?.length) {
      const taggedIds = await this.db
        .selectDistinct({ documentId: documentTags.documentId })
        .from(documentTags)
        .where(inArray(documentTags.tag, q.tags));
      const ids = taggedIds.map((r) => r.documentId);
      if (ids.length === 0) return 0;
      conditions.push(inArray(documents.id, ids));
    }
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
    if (q?.texts?.length) {
      const ftsTerms = q.texts
        .map((t) => `"${t.replace(/"/g, '""')}"`)
        .join(" ");
      const ftsRows = await this.db.all<{ id: string }>(
        sql`SELECT id FROM documents_fts WHERE documents_fts MATCH ${ftsTerms}`,
      );
      const ftsIds = ftsRows.map((r) => r.id);
      if (ftsIds.length === 0) return 0;
      conditions.push(inArray(documents.id, ftsIds));
    }

    // Intentionally skip `before` and `limit` — we want the total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(documents);
    const filtered = whereClause ? query.where(whereClause) : query;
    const [result] = await filtered;
    return Number(result?.count || 0);
  };

  deindexJournal = async (journal: string): Promise<void> => {
    this.db.transaction((trx) => {
      trx.run(
        sql`DELETE FROM documents_fts WHERE id IN (SELECT id FROM documents WHERE journal = ${journal})`,
      );
      trx.delete(documents).where(eq(documents.journal, journal)).run();
    });
  };

  /**
   * Maintenance command: regenerates document_links, image_links, and the
   * FTS index for every row in `documents`, from stored content. Tags are
   * canonical (not derived), so `document_tags` is left untouched.
   */
  rebuildDerived = async (): Promise<{ count: number }> => {
    let count = 0;

    this.db.transaction((trx) => {
      trx.delete(documentLinks).run();
      trx.delete(imageLinks).run();
      trx.run(sql`DELETE FROM documents_fts`);

      const rows = trx
        .select({
          id: documents.id,
          title: documents.title,
          content: documents.content,
        })
        .from(documents)
        .all();

      for (const row of rows) {
        derive(trx, { id: row.id, title: row.title, content: row.content });
        count++;
      }
    });

    return { count };
  };
}
