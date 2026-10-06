import path from "path";
import type { NotesClient } from "../../contract/notes";
import type { Settings } from "../../electron/settings";
import type { Maintenance } from "../../hooks/useMaintenance";
import type { Settings as SettingsFacade } from "../../hooks/useSettings";
import {
  createClient as createNodeClient,
  type NodeClient,
} from "../../node-client/factory";
import { createNodeNotesClient } from "../../node-client/notes-adapter";
import type { PreferencesClient } from "../../node-client/preferences";
import { backups } from "../backups";

/** Electron's Settings: the conf-backed preferences file. */
function createSettings(prefs: PreferencesClient): SettingsFacade {
  return {
    get: (key) => prefs.get(key),
    all: () => prefs.all(),
    setMany: (partial) => prefs.setMultiple(partial),
    location: async () => prefs.settingsPath(),
  };
}

function createMaintenance(client: NodeClient): Maintenance {
  return {
    importNotes: ({ dir, source, onConflict }) =>
      client.importer.import(
        dir,
        source,
        onConflict ? { onConflict } : undefined,
      ),
    exportNotes: ({ dir }) => client.export.export(dir),
    rebuildDerived: () => client.documents.rebuildDerived(),
    resetLibrary: async () => {
      await client.documents.deleteAll();
      await client.journals.ensureDefault();
    },
    backups,
  };
}

/** What the preload hands the renderer, each behind its own accessor. */
export interface HostServices {
  notes: NotesClient;
  settings: SettingsFacade;
  maintenance: Maintenance;
}

export async function createHostServices(
  store: Settings,
): Promise<HostServices> {
  const nodeClient = await createNodeClient({
    dbPath: store.get("databaseUrl"),
    notesDir: store.get("notesDir"),
    // The same settings.json the main process reads, not the `settingsDir`
    // preference (the themes/fonts folder): they differ under
    // CHRONICLES_SETTINGS_DIR, and only match by case on a real profile.
    settingsDir: path.dirname(store.path),
  });

  return {
    notes: createNodeNotesClient(nodeClient),
    settings: createSettings(nodeClient.preferences),
    maintenance: createMaintenance(nodeClient),
  };
}
