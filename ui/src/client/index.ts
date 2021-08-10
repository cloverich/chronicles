import ky from "ky-universal";
import { DocsStore } from "./docstore";
import { IJournal } from "../api/journals";
export { IJournal } from "../api/journals";
import { Root } from "mdast";
import { Client as V2Client } from "../api/client";
import { configure } from "../api/client";

class JournalsClient {
  constructor(private api: KyClient) {}

  list = (): Promise<IJournal[]> => {
    return this.api.ky("journals").json();
  };

  add = (journal: IJournal): Promise<IJournal[]> => {
    return this.api
      .ky("journals", {
        method: "post",
        json: journal,
      })
      .json();
  };

  remove = (journal: IJournal): Promise<IJournal[]> => {
    return this.api
      .ky("journals/" + journal.name, {
        method: "delete",
      })
      .json();
  };
}

export interface GetDocument {
  journalName: string;
  date: string;
  isCreate?: boolean;
}

export interface GetDocumentResponse {
  raw: string;
  mdast: Root | null;
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
  query: SearchRequest;
  docs: Array<[string, string]>; // journal name, date (string, YYYY-MM-DD)
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

export type SaveRequest = SaveRawRequest | SaveMdastRequest;

class DocsClient {
  constructor(private api: KyClient) {}

  findOne = ({
    journalName,
    date,
  }: GetDocument): Promise<GetDocumentResponse> => {
    return this.api.ky.get(`journals/${journalName}/${date}`).json();
  };

  search = (q: SearchRequest): Promise<SearchResponse> => {
    return this.api.ky
      .post("search", {
        json: q,
      })
      .json();
  };

  save = (req: SaveRequest): Promise<GetDocumentResponse> => {
    const body = "raw" in req ? { raw: req.raw } : { mdast: req.mdast };

    return this.api.ky
      .post(`journals/${req.journalName}/${req.date}`, {
        json: body,
      })
      .json();
  };
}

abstract class KyClient {
  ky: typeof ky = (() => {
    throw new Error("ky not configured yet");
  }) as unknown as any;
}

class ClientImplementation extends KyClient {
  readonly journals: JournalsClient;
  readonly docs: DocsClient;
  readonly cache: DocsStore;

  // This not null assertion is required because of how I wrote the
  // original setup script. Refactor consumers to use the configure as
  // defined in the /api/client which seems much simpler? What was I
  // thinking?
  v2!: V2Client;

  constructor() {
    super();
    this.journals = new JournalsClient(this);
    this.docs = new DocsClient(this);
    this.cache = new DocsStore(this);
  }

  /**
   * Set the URL for the API client. Since the port is dynamically provided via electron IPC,
   * this step is necessary to figure out how to make URL calls.
   *
   * @param urlBase - The base url + port for the backend server
   */
  configure(urlBase: string) {
    this.ky = ky.extend({ prefixUrl: urlBase });

    // TODO: Refactor so it takes an existing ky client, or delete this whole
    // shebang
    this.v2 = configure(urlBase);
  }
}

// Hmm. could do this to expose the types but no the class.
export type Client = ClientImplementation;

// singleton
export default new ClientImplementation();
