import crypto from "crypto";
import fs, { Stats } from "fs";
import { Knex } from "knex";
import * as mdastTypes from "mdast";
import path from "path";
import yaml from "yaml";
import {
  mdastToString,
  parseMarkdown,
  selectDistinctImageUrls,
  selectNoteLinks,
} from "../../markdown";
import { parseNoteLink } from "../../views/edit/editor/features/note-linking/toMdast";
import { IFilesClient } from "./files";
import { splitFrontMatter } from "./importer/frontmatter";
import { IPreferencesClient } from "./preferences";

import {
  CreateRequest,
  GetDocumentResponse,
  IndexRequest,
  SearchItem,
  SearchRequest,
  SearchResponse,
  UpdateRequest,
} from "./types";
import { createId } from "./util";

// document as it appears in the database
interface DocumentDb {
  id: string;
  journal: string;
  title?: string;
  frontMatter: string;
  createdAt: string;
  updatedAt: string;
  // Incremental sync support
  mtime?: number; // file modification time (ms since epoch)
  size?: number; // file size in bytes
  contentHash?: string; // SHA-256 hash of file contents
}

// FTS5 table structure
interface DocumentFts {
  id: string;
  title: string;
  content: string;
}

// Metadata for incremental sync checks
export interface DocSyncMeta {
  mtime: number | null;
  size: number | null;
  contentHash: string | null;
}

// table structure of document_links
interface DocumentLinkDb {
  documentId: string;
  targetId: string;
  targetJournal: string;
  resolvedAt: string; // todo: unused
}

export type IDocumentsClient = DocumentsClient;

export class DocumentsClient {
  constructor(
    private knex: Knex,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  findById = async ({ id }: { id: string }): Promise<GetDocumentResponse> => {
    const document = await this.knex<DocumentDb>("documents")
      .where({ id })
      .first();

    // todo: add test 404 behavior
    if (!document) {
      // note: Prefix is used as a code. Since custom errors and .code properties
      // do not cross the preload boundary, a prefix code [<CODE>] can be used by
      // FE to identify the error. This came up after mistaking a mobx not found
      // error for a document not found error.
      throw new Error(`[DOCUMENT_NOT_FOUND] Document ${id} not found`);
    }

    const filepath = path.join(
      await this.preferences.get("notesDir"),
      document.journal,
      `${id}.md`,
    );

    // freshly load the document from disk to avoid desync issues
    const { mdast, frontMatter } = await this.loadDoc(filepath);

    // todo: Are the dates ever null at this point?
    frontMatter.createdAt = frontMatter.createdAt || document.createdAt;
    frontMatter.updatedAt = frontMatter.updatedAt || document.updatedAt;

    return {
      ...document,
      frontMatter,
      content: mdastToString(mdast),
    };
  };

  // note: only used by tests when created
  findByTitle = async (title: string) => {
    const docs = await this.search({
      journals: [],
      titles: [title],
    });

    if (docs.data.length === 0) {
      throw new Error(`Document not found by title: ${title}`);
    }

    const doc = await this.findById({ id: docs.data[0].id });
    if (!doc) {
      throw new Error(
        `Document not found by id: ${docs.data[0].id} (title: ${title})`,
      );
    }

    return doc;
  };

  /**
   * Read raw document contents and compute hash.
   * Use this for incremental sync to check if content changed before parsing.
   *
   * @param filePath - Path to the markdown file
   * @returns { rawContents, contentHash } - Raw file contents and SHA-256 hash
   */
  readDocRaw = async (filePath: string) => {
    const rawContents = await this.files.readDocument(filePath);
    const contentHash = this.computeHash(rawContents);
    return { rawContents, contentHash };
  };

  /**
   * Compute SHA-256 hash of content string.
   */
  private computeHash = (content: string): string => {
    return crypto.createHash("sha256").update(content).digest("hex");
  };

  /**
   * Compute sync metadata for a file after writing it.
   * Used to keep sync metadata current after user edits.
   */
  private computeSyncMeta = async (filePath: string, content: string) => {
    const stats = await fs.promises.stat(filePath);
    return {
      mtime: Math.floor(stats.mtimeMs),
      size: stats.size,
      contentHash: this.computeHash(content),
    };
  };

  /**
   * Parse raw document contents into mdast (expensive operation).
   * Call this only after determining the document needs reindexing.
   *
   * @param rawContents - Raw markdown file contents
   * @param stats - File stats for default date values in frontmatter
   * @returns { mdast, frontMatter } - Parsed body as mdast and frontmatter object
   */
  parseDoc = (rawContents: string, stats: Stats) => {
    const mdast = parseMarkdown(rawContents);
    const { frontMatter, bodyMdast } = splitFrontMatter(mdast, stats);
    return { mdast: bodyMdast, frontMatter };
  };

  /**
   * Load a document from disk, parsing it once into mdast.
   * Returns the parsed mdast (body only, frontmatter removed) and frontMatter object.
   * This is a convenience method that combines readDocRaw + parseDoc.
   *
   * @param filePath - Path to the markdown file
   * @returns { mdast, frontMatter } - Parsed body as mdast and frontmatter object
   */
  loadDoc = async (filePath: string) => {
    const { rawContents } = await this.readDocRaw(filePath);
    const stats = await fs.promises.stat(filePath);
    return this.parseDoc(rawContents, stats);
  };

  /**
   * Get sync metadata for all documents (for incremental sync checks).
   * Returns a Map for O(1) lookups during sync.
   *
   * @returns Map of document ID to sync metadata
   */
  getAllDocSyncMeta = async (): Promise<Map<string, DocSyncMeta>> => {
    const results = await this.knex<DocumentDb>("documents").select(
      "id",
      "mtime",
      "size",
      "contentHash",
    );

    const map = new Map<string, DocSyncMeta>();
    for (const row of results) {
      map.set(row.id, {
        mtime: row.mtime ?? null,
        size: row.size ?? null,
        contentHash: row.contentHash ?? null,
      });
    }
    return map;
  };

  /**
   * Update only sync metadata for a document (when mtime/size changed but hash didn't).
   *
   * @param id - Document ID
   * @param meta - New mtime and size values
   */
  updateDocSyncMeta = async (
    id: string,
    meta: { mtime: number; size: number },
  ) => {
    await this.knex<DocumentDb>("documents").where({ id }).update(meta);
  };

  del = async (id: string, journal: string) => {
    await this.files.deleteDocument(id, journal);
    await this.knex<DocumentDb>("documents").where({ id }).del();
    // Also clean up FTS index (use raw SQL for FTS5 compatibility)
    await this.knex.raw("DELETE FROM documents_fts WHERE id = ?", [id]);
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    let query = this.knex<DocumentDb>("documents");

    if (q?.ids) {
      query = query.whereIn("id", q.ids);
    }

    // filter by journal
    if (q?.journals?.length) {
      query = query.whereIn("journal", q.journals);
    }

    if (q?.tags?.length) {
      query = query
        .join("document_tags", "documents.id", "document_tags.documentId")
        .whereIn("document_tags.tag", q.tags);
    }

    // filter by title
    if (q?.titles?.length) {
      for (const title of q.titles) {
        // note: andWhereILike throws a SQL syntax error in SQLite.
        // It seems case insensitive without it?
        query = query.andWhereLike("documents.title", `%${title}%`);
      }
    }

    // FTS5 full-text search
    if (q?.texts?.length) {
      // Build FTS5 query - join multiple terms with spaces (AND by default)
      // Escape special FTS5 characters and wrap in quotes for phrase matching
      const ftsTerms = q.texts
        .map((t) => `"${t.replace(/"/g, '""')}"`)
        .join(" ");

      // Join with FTS results - get matching document IDs
      query = query
        .join(
          this.knex.raw(
            `(SELECT id as fts_id FROM documents_fts WHERE documents_fts MATCH ?) as fts`,
            [ftsTerms],
          ),
          "documents.id",
          "fts.fts_id",
        )
        .select("documents.*");
    }

    // todo: test id, date, and unknown formats
    if (q?.before) {
      if (this.beforeTokenFormat(q.before) === "date") {
        query = query.andWhere("createdAt", "<", q.before);
      } else {
        query = query.andWhere("id", "<", q.before);
      }
    }

    if (q?.limit) {
      query = query.limit(q.limit);
    }

    query.orderBy("createdAt", "desc");

    // todo: update type to indicate when ids passed, only ids are returned
    if (q?.ids) return { data: await query.select("id") };

    try {
      const results = await query;
      return { data: results as unknown as SearchItem[] };
    } catch (err) {
      console.error("error in client.documents.search", (err as Error).message);
    }

    return { data: [] };
  };

  // Extend front-matter (if any) with Chronicles standard properties, then
  // add to serialized document contents.
  private prependFrontMatter = (
    contents: string,
    frontMatter: Record<string, any>,
  ) => {
    // need to re-add ---, and also double-newline the ending frontmatter
    const fm = ["---", yaml.stringify(frontMatter), "---"].join("\n");

    return `${fm}\n\n${contents}`;
  };

  /**
   * Create (upload) a new document and index it
   * @param args - The document to create
   * @param index - Whether to index the document - set to false when importing (we import, then call indexer.index() instead)
   */
  createDocument = async (
    args: CreateRequest,
    index: boolean = true,
  ): Promise<[string, string]> => {
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

    if (index) {
      // Compute sync metadata after writing file
      const syncMeta = await this.computeSyncMeta(docPath, content);

      // Parse content body to mdast for indexing
      const mdast = parseMarkdown(args.content);
      return [
        await this.createIndex({
          id,
          journal: args.journal,
          mdast,
          frontMatter: args.frontMatter,
          rootDir: await this.preferences.get("notesDir"),
          syncMeta,
        }),
        docPath,
      ];
    } else {
      return [id, docPath];
    }
  };

  updateDocument = async (args: UpdateRequest): Promise<void> => {
    if (!args.id) throw new Error("id required to update document");

    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    // todo: I think we accept this from the client now and just expect
    // callers to update updatedAt, to support importers and sync manually configuring
    // this...
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const content = this.prependFrontMatter(args.content, args.frontMatter);

    const origDoc = await this.findById({ id: args.id });
    const docPath = await this.files.uploadDocument(
      { id: args.id, content },
      args.journal,
    );

    // sigh; this is a bit of a mess.
    if (origDoc.journal !== args.journal) {
      // delete the original markdown file, in the old journal
      // no await, optimistic delete
      this.files.deleteDocument(args.id!, origDoc.journal);
      // update any markdown files which had links pointing to the old journal
      // only necessary because we use markdown links, i.e. ../<journal>/<id>.md
      this.updateDependentLinks([args.id!], args.journal);
    }

    // Compute sync metadata after writing file
    const syncMeta = await this.computeSyncMeta(docPath, content);

    // Parse content body to mdast for indexing
    const mdast = parseMarkdown(args.content);
    await this.updateIndex({
      id: args.id,
      mdast,
      journal: args.journal,
      frontMatter: args.frontMatter,
      rootDir: await this.preferences.get("notesDir"),
      syncMeta,
    });
  };

  // todo: also need to update dependent title, if the title of the original note
  // changes...again wikilinks simplify this.
  private updateDependentLinks = async (
    documentIds: string[],
    journal: string,
  ) => {
    for (const targetId of documentIds) {
      const links = await this.knex<DocumentLinkDb>("document_links").where({
        targetId,
      });

      for (const link of links) {
        const dependentNote = await this.findById({ id: link.documentId });
        console.log(
          "udating links for",
          dependentNote.frontMatter.title,
          dependentNote.id,
        );
        const mdast = parseMarkdown(dependentNote.content);
        const noteLinks = selectNoteLinks(mdast);

        // update the note links to point to the new journal
        noteLinks.forEach((link) => {
          const parsed = parseNoteLink(link.url);
          if (!parsed) return;
          const { noteId } = parsed;
          if (noteId === targetId) {
            // update url to new journal
            link.url = `../${journal}/${noteId}.md`;
            link.journalName = journal;
          }
        });

        await this.updateDocument({
          ...dependentNote,
          content: mdastToString(mdast),
        });
      }
    }
  };

  /**
   * Create or update a document index entry.
   */
  createIndex = async ({
    id,
    journal,
    mdast,
    frontMatter,
    rootDir,
    syncMeta,
  }: IndexRequest): Promise<string> => {
    if (!id) {
      throw new Error("id required to create document index");
    }

    // Serialize mdast to string for FTS indexing
    const content = mdastToString(mdast);
    const title = frontMatter.title || "";

    return this.knex.transaction(async (trx) => {
      // Check if document exists
      const existing = await trx("documents").where({ id }).first();

      if (existing) {
        await trx("documents")
          .where({ id })
          .update({
            journal,
            title: frontMatter.title,
            updatedAt: frontMatter.updatedAt,
            frontMatter: JSON.stringify(frontMatter || {}),
            ...(syncMeta && {
              mtime: syncMeta.mtime,
              size: syncMeta.size,
              contentHash: syncMeta.contentHash,
            }),
          });

        // Clear and re-insert tags
        await trx("document_tags").where({ documentId: id }).del();

        // Update FTS index (delete + insert since FTS5 doesn't support UPDATE well)
        // Use raw SQL because Knex doesn't handle FTS5 virtual tables well
        await trx.raw("DELETE FROM documents_fts WHERE id = ?", [id]);
        await trx.raw(
          "INSERT INTO documents_fts (id, title, content) VALUES (?, ?, ?)",
          [id, title, content],
        );
      } else {
        // Insert new document (content stored in FTS only, not in documents table)
        await trx("documents").insert({
          id,
          journal,
          title: frontMatter.title,
          createdAt: frontMatter.createdAt,
          updatedAt: frontMatter.updatedAt,
          frontMatter: JSON.stringify(frontMatter || {}),
          ...(syncMeta && {
            mtime: syncMeta.mtime,
            size: syncMeta.size,
            contentHash: syncMeta.contentHash,
          }),
        });

        // Insert into FTS index (use raw SQL for FTS5 compatibility)
        await trx.raw(
          "INSERT INTO documents_fts (id, title, content) VALUES (?, ?, ?)",
          [id, title, content],
        );
      }

      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      await this.resetLinks(trx, id, mdast, rootDir, journal);

      return id;
    });
  };

  updateIndex = async ({
    id,
    journal,
    mdast,
    frontMatter,
    rootDir,
    syncMeta,
  }: IndexRequest): Promise<void> => {
    // Serialize mdast to string for FTS indexing
    const content = mdastToString(mdast);
    const title = frontMatter.title || "";

    return this.knex.transaction(async (trx) => {
      // Update main document table (no content column - stored in FTS only)
      await trx("documents")
        .update({
          title: frontMatter.title,
          journal,
          updatedAt: frontMatter.updatedAt,
          frontMatter: JSON.stringify(frontMatter),
          ...(syncMeta && {
            mtime: syncMeta.mtime,
            size: syncMeta.size,
            contentHash: syncMeta.contentHash,
          }),
        })
        .where({ id });

      // Update FTS index (delete + insert since FTS5 doesn't support UPDATE well)
      // Use raw SQL because Knex doesn't handle FTS5 virtual tables well
      await trx.raw("DELETE FROM documents_fts WHERE id = ?", [id]);
      await trx.raw(
        "INSERT INTO documents_fts (id, title, content) VALUES (?, ?, ?)",
        [id, title, content],
      );

      await trx("document_tags").where({ documentId: id }).del();
      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      await this.resetLinks(trx, id, mdast, rootDir, journal);
    });
  };

  private resetLinks = async (
    trx: Knex.Transaction,
    docId: string,
    mdast: mdastTypes.Root,
    rootDir: string,
    journal: string,
  ) => {
    await trx("document_links").where({ documentId: docId }).del();
    await trx("image_links").where({ documentId: docId }).del();
    await this.addNoteLinks(trx, docId, mdast);
    await this.addImageLinks(trx, docId, mdast, rootDir, journal);
  };

  // track image links for a document to assist debugging missing images. Unlike note links, which
  // are live and updated as part of document udpate process, as of now this routine exists purlely
  // for debugging import / indexing issues.
  private addImageLinks = async (
    trx: Knex.Transaction,
    documentId: string,
    mdast: mdastTypes.Root,
    rootDir: string,
    journal: string,
  ) => {
    const imageLinks = selectDistinctImageUrls(mdast);

    // Delete existing image links for this document
    await trx("image_links").where({ documentId }).del();
    if (imageLinks.length <= 0) return;

    // Check each image and insert into the table
    for (const imagePath of imageLinks) {
      // Skip non-local files (http, https, etc)
      if (imagePath.startsWith("http")) {
        continue;
      }

      // Resolve relative path against notes directory
      const resolvedPath = path.resolve(rootDir, journal, imagePath);
      const resolved = await this.files.validFile(resolvedPath, false);
      await trx("image_links").insert({
        documentId,
        imagePath,
        resolved,
        lastChecked: new Date().toISOString(),
      });
    }
  };

  private addNoteLinks = async (
    trx: Knex.Transaction,
    documentId: string,
    mdast: mdastTypes.Root,
  ) => {
    const noteLinks = selectNoteLinks(mdast)
      .map((link) => parseNoteLink(link.url))
      .filter(Boolean) as { noteId: string; journalName: string }[];

    // drop duplicate note links, should only point to a noteId once
    const seen = new Set<string>();
    const noteLinksUnique = noteLinks.filter((link) => {
      if (seen.has(link.noteId)) {
        return false;
      } else {
        seen.add(link.noteId);
        return true;
      }
    });

    if (noteLinks.length > 0) {
      await trx("document_links").insert(
        noteLinksUnique.map((link) => ({
          documentId,
          targetId: link.noteId,
          targetJournal: link.journalName,
        })),
      );
    }
  };

  /**
   * Delete documents that are no longer present on the filesystem.
   * Used by incremental sync to clean up orphaned records.
   *
   * @param seenIds - Set of document IDs that still exist on disk
   */
  deleteOrphanedDocuments = async (seenIds: Set<string>): Promise<number> => {
    // Get all document IDs currently in database
    const allDocs = await this.knex<DocumentDb>("documents").select("id");
    const orphanedIds = allDocs
      .map((d) => d.id)
      .filter((id) => !seenIds.has(id));

    if (orphanedIds.length > 0) {
      // Cascade deletes will handle document_tags, document_links, image_links
      await this.knex<DocumentDb>("documents").whereIn("id", orphanedIds).del();
      // Also clean up FTS index (use raw SQL for FTS5 compatibility)
      for (const orphanId of orphanedIds) {
        await this.knex.raw("DELETE FROM documents_fts WHERE id = ?", [
          orphanId,
        ]);
      }
    }

    return orphanedIds.length;
  };

  /**
   * When removing a journal, call this to de-index all documents from that journal.
   */
  deindexJournal = async (journal: string): Promise<void> => {
    // Get document IDs in this journal for FTS cleanup
    const docs = await this.knex<DocumentDb>("documents")
      .where({ journal })
      .select("id");
    const ids = docs.map((d) => d.id);

    // Delete from main table (cascade handles tags, links, etc.)
    await this.knex<DocumentDb>("documents").where({ journal }).del();

    // Clean up FTS index (use raw SQL for FTS5 compatibility)
    for (const docId of ids) {
      await this.knex.raw("DELETE FROM documents_fts WHERE id = ?", [docId]);
    }
  };

  /**
   * For a given search like `before: token`, determine if the value is a date, an ID, or
   * unknown. This allows paginating / ordering off of before using either
   * createdAt or ID.
   *
   * @param input - The value of the before: token
   */
  beforeTokenFormat = (input: string): "date" | "id" | "unknown" => {
    // Regular expression for ISO date formats: full, year-month, year only
    const dateRegex = /^(?:\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
    // Regular expression for the specific ID format
    const idRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (dateRegex.test(input)) {
      return "date";
    } else if (idRegex.test(input)) {
      return "id";
    } else {
      return "unknown";
    }
  };
}
