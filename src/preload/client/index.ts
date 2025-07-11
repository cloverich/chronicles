import settings from "../../electron/settings";
import { createClient } from "./factory";
import { IClient } from "./types";

export { GetDocumentResponse } from "./types";

let client: IClient;

export function create(): IClient {
  if (!client) {
    client = createClient({
      store: settings,
    }) as IClient;
  }

  return client;
}
