import { JournalsClient } from "./journals";
import { DocumentsClient, GetDocumentResponse } from "./documents";
import { PreferencesClient } from "./preferences";
import { FilesClient } from "./files";
import DB from "better-sqlite3";

import Store from "electron-store";
const settings = new Store({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("DATABASE_URL") as string);

export { GetDocumentResponse } from "./documents";

export interface Client {
  journals: JournalsClient;
  documents: DocumentsClient;
  preferences: PreferencesClient;
  files: FilesClient;
}

let client: Client;
export function create(): Client {
  if (!client) {
    client = {
      journals: new JournalsClient(db),
      documents: new DocumentsClient(db),
      preferences: new PreferencesClient(settings),
      files: new FilesClient(settings),
    };
  }

  return client;
}
