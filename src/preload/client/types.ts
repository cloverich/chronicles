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
  content: string;
  journal: string;
  frontMatter: FrontMatter;
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

export interface CreateRequest {
  id?: string;
  journal: string;
  content: string;
  frontMatter: FrontMatter;
}

export interface UpdateRequest extends CreateRequest {
  id: string;
}

// arbitrary front matter is allowed, but a subset of properties
// are tracked as first-class citizens by the application
export interface FrontMatter {
  title?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface IndexRequest {
  id: string;
  journal: string;
  content: string;
  frontMatter: FrontMatter;
  rootDir: string;
}

// Nobody would put node_modules in their note directory... right?
// todo: Make this configurable
export const SKIPPABLE_FILES = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
]);

// Skip hidden folders and files, especially .git, .DS_Store, .Thumbs.db, etc
// NOTE: This also skips _attachments, so add exclusion in importer routine
export const SKIPPABLE_PREFIXES = new Set([".", "_", "*", "~"]);
