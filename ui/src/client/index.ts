import ky from "ky-universal";
import { DocsStore } from "./docstore";

export interface IJournal {
  name: string;
  url: string;
}

class JournalsClient {
  constructor(private urlBase: string) {}

  list = (): Promise<IJournal[]> => {
    return ky(this.urlBase + "/journals").json();
  };

  add = (journal: IJournal): Promise<IJournal[]> => {
    return ky(this.urlBase + "/journals", {
      method: "post",
      json: journal,
    }).json();
  };

  remove = (journal: IJournal): Promise<IJournal[]> => {
    return ky(this.urlBase + "/journals/" + journal.name, {
      method: "delete",
    }).json();
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

// DocsQuery in deno-api
export interface SearchRequest {
  journals?: string[];

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
  constructor(private urlBase: string) {}

  findOne = ({
    journalName,
    date,
  }: GetDocument): Promise<GetDocumentResponse> => {
    return ky.get(this.urlBase + `/journals/${journalName}/${date}`).json();
  };

  search = (q: SearchRequest): Promise<SearchResponse> => {
    return ky
      .post(this.urlBase + "/search", {
        json: q,
      })
      .json();
  };

  save = (req: SaveRequest): Promise<GetDocumentResponse> => {
    const body = "raw" in req ? { raw: req.raw } : { mdast: req.mdast };

    return ky
      .post(this.urlBase + `/journals/${req.journalName}/${req.date}`, {
        json: body,
      })
      .json();
  };
}

export class Client {
  readonly journals: JournalsClient;
  readonly docs: DocsClient;
  readonly cache: DocsStore;

  constructor(urlBase: string) {
    this.journals = new JournalsClient(urlBase);
    this.docs = new DocsClient(urlBase);
    this.cache = new DocsStore(this);
  }
}
