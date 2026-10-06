import type { Settings } from "../../electron/settings";
import type { Settings as SettingsFacade } from "../../hooks/useSettings";
import { createClient as createNodeClient } from "../../node-client/factory";
import { createNodeNotesClient } from "../../node-client/notes-adapter";
import type { PreferencesClient } from "../../node-client/preferences";

/** Electron's Settings: the conf-backed preferences file. */
function createSettings(prefs: PreferencesClient): SettingsFacade {
  return {
    get: (key) => prefs.get(key),
    all: () => prefs.all(),
    setMany: (partial) => prefs.setMultiple(partial),
    location: async () => prefs.settingsPath(),
  };
}

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
    notes: createNodeNotesClient(nodeClient),
    settings: createSettings(nodeClient.preferences),
    journals: nodeClient.journals,
    documents: nodeClient.documents,
    tags: nodeClient.tags,
    preferences: nodeClient.preferences,
    files: nodeClient.files,
    importer: nodeClient.importer,
    bulkOperations: nodeClient.bulkOperations,
    export: nodeClient.export,
  };
}
