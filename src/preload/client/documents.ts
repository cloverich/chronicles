import { Database } from "better-sqlite3";
import { Knex } from 'knex';
import { uuidv7 } from "uuidv7";

export interface GetDocumentResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  content: string;
  journalId: string;
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

// Now straight up copying from the API layer
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

  // these included for override, originally,
  // to support the import process
  createdAt?: string;
  updatedAt?: string;
}

export type IDocumentsClient = DocumentsClient;

export class DocumentsClient {
  constructor(private db: Database, private knex: Knex) { }

  findById = ({
    documentId,
  }: {
    documentId: string;
  }): Promise<GetDocumentResponse> => {
    const doc = this.db
      .prepare("select * from documents where id = :id")
      .get({ id: documentId });

    return doc;
  };

  del = async (id: string) => {
    this.db.prepare("delete from documents where id = :id").run({ id });
  };


  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    // todo: consider using raw and getting arrays of values rather than
    // objects for each row, for performance
    let query = this.knex('documents')

    // filter by journal
    if (q?.journals?.length) {
      query = query.whereIn('journalId', q.journals);
    }

    // filter by title
    if (q?.titles?.length) {
      for (const title of q.titles) {
        // note: andWhereILike throws a SQL syntax error in SQLite.
        // It seems case insensitive without it?
        query = query.andWhereLike('title', `%${title}%`);
      }
    }

    // filter by raw text
    if (q?.texts?.length) {
      for (const rawTxt of q.texts) {
        query = query.andWhereLike('content', `%${rawTxt}%`)
      }
    }

    if (q?.before) {
      query.andWhere('createdAt', '<', q.before);
    }

    query.orderBy('createdAt', 'desc')

    try {
      const results = await query;
      return { data: results as unknown as SearchItem[] }
    } catch (err) {
      console.error('error in clinet.documents.search', err);
    }

    return { data: [] }
  };

  save = ({
    id,
    createdAt,
    updatedAt,
    journalId,
    content,
    title,
  }: SaveRequest): Promise<GetDocumentResponse> => {
    if (id) {
      this.db
        .prepare(
          `
        update documents set
          journalId=:journalId,
          content=:content,
          title=:title,
          updatedAt=:updatedAt,
          createdAt=:createdAt
        where
          id=:id
      `
        )
        .run({
          id,
          content,
          title,
          journalId,
          updatedAt: new Date().toISOString(),
          createdAt,
        });

      return this.db
        .prepare(
          `select * from documents where id = :id order by "createdAt" desc`
        )
        .get({ id });
    } else {
      const id = uuidv7();
      this.db
        .prepare(
          `
        insert into documents (id, journalId, content, title, createdAt, updatedAt) 
        values (:id, :journalId, :content, :title, :createdAt, :updatedAt)
      `
        )
        .run({
          id,
          journalId,
          content,
          title,
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: updatedAt || new Date().toISOString(),
        });

      return this.db
        .prepare(
          `select * from documents where id = :id order by "createdAt" desc`
        )
        .get({ id });
    }
  };
}
