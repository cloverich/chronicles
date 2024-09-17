import DB from "better-sqlite3";
import Knex from "knex";
import { DocumentsClient } from "./documents";
import { ExportClient } from "./exporter";
import { FilesClient } from "./files";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
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
  const journals = new JournalsClient(db);
  const documents = new DocumentsClient(db, knex);
  const files = new FilesClient(settings);
  if (!client) {
    client = {
      journals: journals,
      documents: documents,
      tags: new TagsClient(db, knex),
      preferences: new PreferencesClient(settings),
      files: files,
      export: new ExportClient(db, knex, journals, documents, files, settings),
    };
  }

  return client;
}
