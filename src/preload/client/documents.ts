import { Database } from "better-sqlite3";
import { Knex } from "knex";
import { uuidv7 } from "uuidv7";

export interface GetDocumentResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  content: string;
  journalId: string;
  tags: string[];
}

/**
 * Structure for searching journal content.
 */
export interface SearchRequest {
  /**
   * Filter to these journals. The empty array is treated as "all journals",
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
  journalId: string;
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
  journalId: string;
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

  del = async (id: string) => {
    this.db.prepare("delete from documents where id = :id").run({ id });
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    let query = this.knex("documents");

    // filter by journal
    if (q?.journals?.length) {
      query = query.whereIn("journalId", q.journals);
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
  save = (args: SaveRequest): Promise<GetDocumentResponse> => {
    // de-dupe tags -- should happen before getting here.
    args.tags = Array.from(new Set(args.tags));

    const id = this.db.transaction(() => {
      if (args.id) {
        this.updateDocument(args);
        return args.id;
      } else {
        return this.createDocument(args);
      }
    })();

    return this.findById({ id });
  };

  private createDocument = ({
    createdAt,
    updatedAt,
    journalId,
    content,
    title,
    tags,
  }: SaveRequest): string => {
    const id = uuidv7();
    this.db
      .prepare(
        `INSERT INTO documents (id, journalId, content, title, createdAt, updatedAt) VALUES (:id, :journalId, :content, :title, :createdAt, :updatedAt)`,
      )
      .run({
        id,
        journalId,
        content,
        title,
        // allow passing createdAt to support backfilling prior notes
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    if (tags.length > 0) {
      this.db
        .prepare(
          `INSERT INTO document_tags (documentId, tag) VALUES ${tags.map((tag) => `(:documentId, '${tag}')`).join(", ")}`,
        )
        .run({ documentId: id });
    }

    return id;
  };

  private updateDocument = ({
    id,
    createdAt,
    journalId,
    content,
    title,
    tags,
  }: SaveRequest): void => {
    this.db
      .prepare(
        `UPDATE documents SET journalId=:journalId, content=:content, title=:title, updatedAt=:updatedAt, createdAt=:createdAt WHERE id=:id`,
      )
      .run({
        id,
        content,
        title,
        journalId,
        updatedAt: new Date().toISOString(),
        createdAt,
      });

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
