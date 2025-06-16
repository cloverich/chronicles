import DB from "better-sqlite3";
import Knex from "knex";
import { DocumentsClient } from "./documents";
import { FilesClient } from "./files";
import { ImporterClient } from "./importer";
import { runTests } from "./importer/test";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
import { SyncClient } from "./sync";
import { TagsClient } from "./tags";
import { IClient } from "./types";

import Store from "electron-store";
import { IPreferences } from "../../hooks/stores/preferences";

// todo: json schema
const settings = new Store<IPreferences>({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("databaseUrl") as string);

// Added knex for search which required lots of query mix and
// matching
// todo: migrate codebase to prefer knex to directly using
// the better-sqlite3 client
const knex = Knex({
  client: "better-sqlite3", // or 'better-sqlite3'
  connection: {
    filename: settings.get("databaseUrl") as string,
  },
  // https://knexjs.org/guide/query-builder.html#insert
  // don't replace undefined with "DEFAULT" in insert statements; replace
  // it with NULL instead (SQLite raises otherwise)
  useNullAsDefault: true,
});

export { GetDocumentResponse } from "./types";

let client: IClient;

// no CI test runner for electron tests; so exposed via client so they can be called from the app
// todo: run via cli, then via CI
class TestsClient {
  constructor() {}
  runTests = async () => {
    await runTests();
  };
}

export function create(): IClient {
  if (!client) {
    const preferences = new PreferencesClient(settings);
    const files = new FilesClient(settings);
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

    client = {
      journals: journals,
      documents: documents,
      tags: new TagsClient(knex),
      preferences: preferences,
      files: files,
      sync,
      importer,
      tests: new TestsClient(),
    };
  }

  return client;
}
