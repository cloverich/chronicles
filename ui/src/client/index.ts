import ky from "ky-universal";
import { DocsStore } from "./docstore";
import { IJournal } from "../api/journals";
export { IJournal } from "../api/journals";

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
  // todo: MDAST types
  mdast: any; // Record<string, any>;
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
    type: string; // type of Node
    attributes: any; // match one or more attributes of the node, like depth for heading nodes
    text: string; // match raw text from within the node
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
  ky: typeof ky = ((() => {
    throw new Error("ky not configured yet");
  }) as unknown) as any;
}

class ClientImplementation extends KyClient {
  readonly journals: JournalsClient;
  readonly docs: DocsClient;
  readonly cache: DocsStore;

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
  }
}

// Hmm. could do this to expose the types but no the class.
export type Client = ClientImplementation;

// singleton
export default new ClientImplementation();
