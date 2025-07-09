import { Database } from "better-sqlite3";
import Store from "electron-store";
import { Knex } from "knex";
import { IPreferences } from "../../hooks/stores/preferences";
import { DocumentsClient } from "./documents";
import { FilesClient } from "./files";
import { ImporterClient } from "./importer";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
import { SyncClient } from "./sync";
import { TagsClient } from "./tags";
import { IClient } from "./types";

interface TestsClient {
  runTests: () => Promise<void>;
}

interface ClientFactoryParams {
  db: Database;
  knex: Knex;
  store: Store<IPreferences>;
  testsClient?: TestsClient;
}

export function createClient({
  db,
  knex,
  store,
  testsClient,
}: ClientFactoryParams): Omit<IClient, "tests"> | IClient {
  const preferences = new PreferencesClient(store);
  const files = new FilesClient(store);
  const journals = new JournalsClient(knex, files, preferences);
  const documents = new DocumentsClient(db, knex, files, preferences);
  const sync = new SyncClient(
    db,
    knex,
    journals,
    documents,
    files,
    preferences,
  );

  const importer = new ImporterClient(
    knex,
    documents,
    files,
    preferences,
    sync,
  );

  const baseClient = {
    journals: journals,
    documents: documents,
    tags: new TagsClient(knex),
    preferences: preferences,
    files: files,
    sync,
    importer,
  };

  if (testsClient) {
    return {
      ...baseClient,
      tests: testsClient,
    } as IClient;
  }

  return baseClient;
}
