import type { Settings } from "../../electron/settings";
import { createClient as createNodeClient } from "../../node-client/factory";

interface ClientFactoryParams {
  store: Settings;
}

export async function createClient({ store }: ClientFactoryParams) {
  const nodeClient = await createNodeClient({
    dbPath: store.get("databaseUrl"),
    notesDir: store.get("notesDir"),
    settingsDir: store.get("settingsDir"),
  });

  return {
    journals: nodeClient.journals,
    documents: nodeClient.documents,
    tags: nodeClient.tags,
    preferences: nodeClient.preferences,
    files: nodeClient.files,
    indexer: nodeClient.indexer,
    importer: nodeClient.importer,
    bulkOperations: nodeClient.bulkOperations,
  };
}
