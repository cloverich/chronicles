import settings from "../../electron/settings";
import { createClient } from "./factory";
import { IClient } from "./types";

export { GetDocumentResponse } from "./types";

let client: IClient;

/**
 * Singleton to conditionally instantiate the preload client, supplying
 * settings
 */
export function getClient(): IClient {
  if (!client) {
    client = createClient({
      store: settings,
    }) as IClient;
  }

  return client;
}
