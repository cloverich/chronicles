import settings from "../../electron/settings";
import { createClient } from "./factory";
import { IClient } from "./types";

export { GetDocumentResponse } from "./types";

let client: IClient | undefined;
let clientPromise: Promise<IClient> | undefined;

/**
 * Initialize the client eagerly. Call this once during preload script startup
 * so that getClient() can return synchronously after initialization completes.
 */
export function initClient(): Promise<IClient> {
  if (!clientPromise) {
    clientPromise = createClient({ store: settings }).then((c) => {
      client = c as IClient;
      return client;
    });
  }
  return clientPromise;
}

/**
 * Singleton to conditionally instantiate the preload client, supplying
 * settings.
 *
 * NOTE: initClient() must be awaited before calling getClient(). If getClient()
 * is called before initialization completes, it throws an error.
 */
export function getClient(): IClient {
  if (!client) {
    throw new Error(
      "[chronicles] getClient() called before initClient() completed. " +
        "Ensure initClient() is awaited during preload startup.",
    );
  }
  return client;
}
