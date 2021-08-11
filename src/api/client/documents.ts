import { Root } from "mdast";
import ky from "ky-universal";
type Ky = typeof ky;

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
}

export class DocumentsClient {
  constructor(private ky: Ky) {}

  findById = ({
    documentId,
  }: {
    documentId: string;
  }): Promise<GetDocumentResponse> => {
    return this.ky.get(`v2/documents/${documentId}`).json();
  };

  search = (q?: SearchRequest): Promise<SearchResponse> => {
    return this.ky
      .post("v2/search", {
        json: q,
      })
      .json();
  };

  save = (req: SaveRequest): Promise<GetDocumentResponse> => {
    // const body = "raw" in req ? { raw: req.raw } : { mdast: req.mdast };

    return this.ky
      .post(`v2/documents`, {
        json: req,
      })
      .json();
  };
}
