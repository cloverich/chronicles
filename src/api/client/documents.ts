import { Root } from "mdast";
import ky from "ky-universal";
type Ky = typeof ky;
import { Database } from "better-sqlite3";
import cuid from "cuid";

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
 *
 * todo: DocsQuery in the API. Refactor, re-name, merge
 */
export interface SearchRequest {
  /**
   * Filter to these journals. The empty array is treated as "all journals",
   * rather than None.
   */
  journals: string[];

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
  // query: SearchRequest;
  data: Array<{
    id: string;
    createdAt: string;
    title?: string;
    journalId: string;
  }>;
};

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

export class DocumentsClient {
  constructor(private ky: Ky, private db: Database) {}

  findById = ({
    documentId,
  }: {
    documentId: string;
  }): Promise<GetDocumentResponse> => {
    const doc = this.db
      .prepare("select * from documents where id = :id")
      .get({ id: documentId });
    console.log(doc);
    return doc;
    // return this.ky.get(`v2/documents/${documentId}`).json();
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    // todo: consider using raw and getting arrays of values rather than
    // objects for each row
    if (q?.journals) {
      return {
        data: this.db
          .prepare("select * from documents where id in (:journalIds)")
          .all({ journalIds: q.journals }),
      };
    } else {
      return {
        data: this.db.prepare("select * from documents").all(),
      };
    }
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
          updatedAt=:updatedAt
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
        });

      return this.db
        .prepare(`select * from documents where id = :id`)
        .get({ id });
    } else {
      const id = cuid();
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
        .prepare(`select * from documents where id = :id`)
        .get({ id });
    }
  };
}
