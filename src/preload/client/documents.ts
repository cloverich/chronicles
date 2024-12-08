import { Database } from "better-sqlite3";
import { Knex } from "knex";
import { uuidv7obj } from "uuidv7";
import { mdastToString, parseMarkdown, selectNoteLinks } from "../../markdown";
import { parseNoteLink } from "../../views/edit/editor/features/note-linking/toMdast";
import { IFilesClient } from "./files";

export interface GetDocumentResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  content: string;
  journal: string;
  tags: string[];
}

// table structure of document_links
interface DocumentLinkDb {
  documentId: string;
  targetId: string;
  targetJournal: string;
  resolvedAt: string; // todo: unused
}

/**
 * Structure for searching journal content.
 */
export interface SearchRequest {
  /**
   * Filter by journal (array of Ids).
   * The empty array is treated as "all journals",
   * rather than None.
   */
  journals: string[];

  /**
   * Filter to documents matching one of these titles
   */
  titles?: string[];

  /**
   * Filter documents to those older than a given date
   */
  before?: string;

  /**
   * Search document body text
   */
  texts?: string[];

  /**
   * Search document #tags. ex: ['mytag', 'othertag']
   */
  tags?: string[];

  limit?: number;

  nodeMatch?: {
    /**
     * Type of node
     *
     * https://github.com/syntax-tree/mdast#nodes
     */
    type: string; // type of Node
    /**
     * Match one or more attributes of a node
     */
    attributes?: Record<string, string | number>;
    text?: string; // match raw text from within the node
  };
}

export type SearchResponse = {
  data: SearchItem[];
};

export interface SearchItem {
  id: string;
  createdAt: string;
  title?: string;
  journal: string;
}

export interface SaveRawRequest {
  journalName: string;
  date: string;
  raw: string;
}

export interface SaveMdastRequest {
  journalName: string;
  date: string;
  mdast: any;
}

// export type SaveRequest = SaveRawRequest | SaveMdastRequest;

export interface SaveRequest {
  id?: string;
  journal: string;
  content: string;
  title?: string;
  tags: string[];

  // these included for override, originally,
  // to support the import process
  createdAt?: string;
  updatedAt?: string;
}

export type IDocumentsClient = DocumentsClient;

export class DocumentsClient {
  constructor(
    private db: Database,
    private knex: Knex,
    private files: IFilesClient,
  ) {}

  findById = ({ id }: { id: string }): Promise<GetDocumentResponse> => {
    const document = this.db
      .prepare(`SELECT * FROM documents WHERE id = :id`)
      .get({ id });
    const documentTags = this.db
      .prepare(`SELECT tag FROM document_tags WHERE documentId = :documentId`)
      .all({ documentId: id })
      .map((row) => row.tag);
    return {
      ...document,
      tags: documentTags,
    };
  };

  del = async (id: string, journal: string) => {
    await this.files.deleteDocument(id, journal);
    this.db.prepare("delete from documents where id = :id").run({ id });
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    let query = this.knex("documents");

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
        query = query.andWhereLike("title", `%${title}%`);
      }
    }

    // filter by raw text
    if (q?.texts?.length) {
      for (const rawTxt of q.texts) {
        query = query.andWhereLike("content", `%${rawTxt}%`);
      }
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

    try {
      const results = await query;
      return { data: results as unknown as SearchItem[] };
    } catch (err) {
      console.error("error in clinet.documents.search", err);
    }

    return { data: [] };
  };

  /**
   * Create or update a document and its tags
   *
   * todo: test; for tags: test prefix is removed, spaces are _, lowercased, max length
   * todo: test description max length
   *
   * @returns - The document as it exists after the save
   */
  save = async (args: SaveRequest): Promise<GetDocumentResponse> => {
    // de-dupe tags -- should happen before getting here.
    args.tags = Array.from(new Set(args.tags));
    let id;

    args.title = args.title;
    args.updatedAt = args.updatedAt || new Date().toISOString();

    if (args.id) {
      this.updateDocument(args);
      id = args.id;
    } else {
      args.createdAt = new Date().toISOString();
      args.updatedAt = new Date().toISOString();
      [id] = await this.createDocument(args);
    }

    return this.findById({ id });
  };

  /**
   * Convert the properties we track to frontmatter
   */
  contentsWithFrontMatter = (document: SaveRequest) => {
    const fm = `---
title: ${document.title}
tags: ${document.tags.join(", ")}
createdAt: ${document.createdAt}
updatedAt: ${document.updatedAt}
---`;

    return `${fm}\n\n${document.content}`;
  };

  /**
   * Create (upload) a new document and index it
   * @param args - The document to create
   * @param index - Whether to index the document - set to false when importing (we import, then call `sync` instead)
   */
  createDocument = async (
    args: SaveRequest,
    index: boolean = true,
  ): Promise<[string, string]> => {
    const id = args.id || uuidv7obj().toHex();
    const content = this.contentsWithFrontMatter(args);
    const docPath = await this.files.uploadDocument(
      { id, content },
      args.journal,
    );

    if (index) {
      return [await this.createIndex({ id, ...args }), docPath];
    } else {
      return [id, docPath];
    }
  };

  private updateDocument = async (args: SaveRequest): Promise<void> => {
    const content = this.contentsWithFrontMatter(args);

    const origDoc = await this.findById({ id: args.id! });
    await this.files.uploadDocument({ id: args.id!, content }, args.journal);

    // sigh; this is a bit of a mess
    if (origDoc.journal !== args.journal) {
      // no await, optimistic delete
      this.files.deleteDocument(args.id!, origDoc.journal);
      this.updateDependentLinks([args.id!], args.journal);
    }

    return await this.updateIndex(args);
  };

  // todo: also need to update dependent title, if the title of the original note
  // changes...again wikilinks simplify this.
  updateDependentLinks = async (documentIds: string[], journal: string) => {
    for (const targetId of documentIds) {
      const links = await this.knex<DocumentLinkDb>("document_links").where({
        targetId,
      });

      for (const link of links) {
        const dependentNote = await this.findById({ id: link.documentId });
        console.log("udating links for", dependentNote.title, dependentNote.id);
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

        await this.save({
          ...dependentNote,
          content: mdastToString(mdast),
        });
      }
    }
  };

  createIndex = async ({
    id,
    createdAt,
    updatedAt,
    journal,
    content,
    title,
    tags,
  }: SaveRequest): Promise<string> => {
    if (!id) {
      throw new Error("id required to create document index");
    }

    return this.db.transaction(async () => {
      this.db
        .prepare(
          `INSERT INTO documents (id, journal, content, title, createdAt, updatedAt) VALUES (:id, :journal, :content, :title, :createdAt, :updatedAt)`,
        )
        .run({
          id,
          journal,
          content,
          title,
          // allow passing createdAt to support backfilling prior notes
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: updatedAt || new Date().toISOString(),
        });

      if (tags.length > 0) {
        this.db
          .prepare(
            `INSERT INTO document_tags (documentId, tag) VALUES ${tags.map((tag) => `(:documentId, '${tag}')`).join(", ")}`,
          )
          .run({ documentId: id });
      }

      await this.addNoteLinks(id, content);

      return id;
    })();
  };

  updateIndex = async ({
    id,
    createdAt,
    updatedAt,
    journal,
    content,
    title,
    tags,
  }: SaveRequest): Promise<void> => {
    return this.db.transaction(async () => {
      this.db
        .prepare(
          `UPDATE documents SET journal=:journal, content=:content, title=:title, updatedAt=:updatedAt, createdAt=:createdAt WHERE id=:id`,
        )
        .run({
          id,
          content,
          title,
          journal,
          updatedAt: updatedAt || new Date().toISOString(),
          createdAt,
        });

      // re-create tags to avoid diffing
      this.db
        .prepare(`DELETE FROM document_tags WHERE documentId = :documentId`)
        .run({ documentId: id });

      if (tags.length > 0) {
        this.db
          .prepare(
            `INSERT INTO document_tags (documentId, tag) VALUES ${tags.map((tag) => `(:documentId, '${tag}')`).join(", ")}`,
          )
          .run({ documentId: id });
      }

      // re-create note links to avoid diffing
      await this.knex("document_links").where({ documentId: id }).del();
      await this.addNoteLinks(id!, content);
    })();
  };

  private addNoteLinks = async (documentId: string, content: string) => {
    const mdast = parseMarkdown(content);
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
      await this.knex("document_links").insert(
        noteLinksUnique.map((link) => ({
          documentId,
          targetId: link.noteId,
          targetJournal: link.journalName,
        })),
      );
    }
  };

  /**
   * When removing a journal, call this to de-index all documents from that journal.
   */
  deindexJournal = (journal: string): void => {
    this.db
      .prepare("DELETE FROM documents WHERE journal = :journal")
      .run({ journal });
  };

  /**
   * For a given before: token, determine if the value is a date, an ID, or
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
