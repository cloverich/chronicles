import DB from "better-sqlite3";
import Knex from "knex";
import { DocumentsClient } from "./documents";
import { FilesClient } from "./files";
import { ImporterClient } from "./importer";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
import { SyncClient } from "./sync";
import { TagsClient } from "./tags";
import { IClient } from "./types";

import Store from "electron-store";
const settings = new Store({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("DATABASE_URL") as string);

// Added knex for search which required lots of query mix and
// matching
// todo: migrate codebase to prefer knex to directly using
// the better-sqlite3 client
const knex = Knex({
  client: "better-sqlite3", // or 'better-sqlite3'
  connection: {
    filename: settings.get("DATABASE_URL") as string,
  },
  // https://knexjs.org/guide/query-builder.html#insert
  // don't replace undefined with "DEFAULT" in insert statements; replace
  // it with NULL instead (SQLite raises otherwise)
  useNullAsDefault: true,
});

export { GetDocumentResponse } from "./types";

let client: IClient;

class TestsClient {
  constructor(private importer: ImporterClient) {}
  runTests = () => {
    console.log("todo: fixme");
  };
}

export function create(): IClient {
  if (!client) {
    const preferences = new PreferencesClient(settings);
    const files = new FilesClient(settings);
    const journals = new JournalsClient(db, files, preferences);
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
      db,
      knex,
      journals,
      documents,
      files,
      preferences,
      sync,
    );

    client = {
      journals: journals,
      documents: documents,
      tags: new TagsClient(db, knex),
      preferences: preferences,
      files: files,
      sync,
      importer,
      tests: new TestsClient(importer),
    };
  }

  return client;
}
