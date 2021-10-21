import { JournalsClient, IJournalsClient } from "./journals";
import { DocumentsClient, GetDocumentResponse } from "./documents";
import { PreferencesClient, IPreferencesClient } from "./preferences";
import { FilesClient } from "./files";
import { IClient } from "./types";
import DB from "better-sqlite3";

import Store from "electron-store";
const settings = new Store({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("DATABASE_URL") as string);

export { GetDocumentResponse } from "./documents";

let client: IClient;
export function create(): IClient {
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
