import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IImporterClient } from "./importer";
import { IJournalsClient } from "./journals";
import { IPreferencesClient } from "./preferences";
import { ISyncClient } from "./sync";
import { ITagsClient } from "./tags";

interface TestsClient {
  runTests: () => void;
}

// This interface was created with these "I" types like this
// so non-preload code could import this type without the bundler
// trying (and failing) to bundle unrelated preload code, which expects
// to be run in a node environment.
export interface IClient {
  journals: IJournalsClient;
  tags: ITagsClient;
  documents: IDocumentsClient;
  preferences: IPreferencesClient;
  files: IFilesClient;
  sync: ISyncClient;
  importer: IImporterClient;
  tests: TestsClient;
}

export type JournalResponse = {
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export interface GetDocumentResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  content: string;
  journal: string;
  tags: string[];
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
