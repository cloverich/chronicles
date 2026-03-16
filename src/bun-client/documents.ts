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

      // FTS stub: Phase 5 will add FTS indexing here
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

      // FTS stub: Phase 5 will update FTS here
    });
  };

  del = async (id: string, journal: string): Promise<void> => {
    await this.files.deleteDocument(id, journal);
    await this.db.delete(documents).where(eq(documents.id, id));
    // FTS stub: Phase 5 will clean up FTS here
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
      conditions.push(lt(documents.createdAt, q.before));
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

    // FTS text search stub: Phase 5 will add FTS join here
    // q?.texts is intentionally ignored in Phase 4

    const cols = {
      id: documents.id,
      createdAt: documents.createdAt,
      title: documents.title,
      journal: documents.journal,
    };
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const base = this.db.select(cols).from(documents);
    const rows = await (whereClause ? base.where(whereClause) : base).orderBy(
      sql`${documents.createdAt} DESC`,
    );

    const results = q?.limit ? rows.slice(0, q.limit) : rows;

    return { data: results as SearchItem[] };
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
      await this.db.delete(documents).where(
        inArray(
          documents.id,
          orphaned.map((d) => d.id),
        ),
      );
      // FTS stub: Phase 5 will clean FTS here
    }

    return orphaned.length;
  };

  deindexJournal = async (journal: string): Promise<void> => {
    await this.db.delete(documents).where(eq(documents.journal, journal));
    // FTS stub: Phase 5 will clean FTS here
  };
}
