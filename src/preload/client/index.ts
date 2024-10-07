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
});

export { GetDocumentResponse } from "./documents";

let client: IClient;
export function create(): IClient {
  if (!client) {
    // runFrontmatterTests();
    const preferences = new PreferencesClient(settings);
    const files = new FilesClient(settings);
    const journals = new JournalsClient(db, files, preferences);
    const documents = new DocumentsClient(db, knex, files);
    const sync = new SyncClient(
      db,
      knex,
      journals,
      documents,
      files,
      preferences,
    );

    client = {
      journals: journals,
      documents: documents,
      tags: new TagsClient(db, knex),
      preferences: preferences,
      files: files,
      sync,
      importer: new ImporterClient(
        db,
        knex,
        journals,
        documents,
        files,
        preferences,
        sync,
      ),
    };
  }

  return client;
}
