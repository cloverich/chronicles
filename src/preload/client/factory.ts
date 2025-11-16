import Knex from "knex";
import { Settings } from "../../electron/settings";
import { DocumentsClient } from "./documents";
import { FilesClient } from "./files";
import { ImporterClient } from "./importer";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
import { SyncClient } from "./sync";
import { TagsClient } from "./tags";
import { IClient } from "./types";

interface ClientFactoryParams {
  store: Settings;
}

/**
 * Creates the preload client, accepting `store` to support testing.
 */
export function createClient({ store }: ClientFactoryParams): IClient {
  const knex = Knex({
    client: "better-sqlite3",
    connection: {
      filename: store.get("databaseUrl"),
    },
    // https://knexjs.org/guide/query-builder.html#insert
    // don't replace undefined with "DEFAULT" in insert statements; replace
    // it with NULL instead (SQLite raises otherwise)
    useNullAsDefault: true,
  });

  const preferences = new PreferencesClient(store);
  const files = new FilesClient(store);
  const journals = new JournalsClient(knex, files, preferences);
  const documents = new DocumentsClient(knex, files, preferences);
  const sync = new SyncClient(knex, journals, documents, files, preferences);

  const importer = new ImporterClient(
    knex,
    documents,
    files,
    preferences,
    sync,
  );

  const baseClient = {
    knex,
    journals: journals,
    documents: documents,
    tags: new TagsClient(knex),
    preferences: preferences,
    files: files,
    sync,
    importer,
  };

  return baseClient;
}
