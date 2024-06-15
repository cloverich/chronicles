import { IJournalsClient } from "./journals";
import { IDocumentsClient } from "./documents";
import { IPreferencesClient } from "./preferences";
import { IFilesClient } from "./files";
import { ITagsClient } from "./tags";

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
}
