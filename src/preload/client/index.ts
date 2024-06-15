import { JournalsClient } from "./journals";
import { DocumentsClient } from "./documents";
import { TagsClient } from "./tags";
import { PreferencesClient } from "./preferences";
import { FilesClient } from "./files";
import { IClient } from "./types";
import DB from "better-sqlite3";
import Knex from "knex";

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
    client = {
      journals: new JournalsClient(db),
      documents: new DocumentsClient(db, knex),
      tags: new TagsClient(db, knex),
      preferences: new PreferencesClient(settings),
      files: new FilesClient(settings),
    };
  }

  return client;
}
