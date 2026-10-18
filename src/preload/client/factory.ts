import path from "path";
import type { NotesClient } from "../../contract/notes";
import type { Settings } from "../../electron/settings";
import type { Maintenance } from "../../hooks/useMaintenance";
import type { Settings as SettingsFacade } from "../../hooks/useSettings";
import type { PublishTarget } from "../../markdown/publishProjection";
import {
  createClient as createNodeClient,
  type NodeClient,
} from "../../node-client/factory";
import { createNodeNotesClient } from "../../node-client/notes-adapter";
import type {
  IPreferences,
  PreferencesClient,
} from "../../node-client/preferences";
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

const DEFAULT_BLOG_TARGET: PublishTarget = {
  kind: "hugo-bundle",
  frontMatter: ["description", "tags"],
  urlPrefix: "/blog/",
  provenance: true,
};

/** The blog root and target, when the note may be published there. */
async function blogFor(client: NodeClient, id: string) {
  const blog = (await client.preferences.get("blog")) as IPreferences["blog"];
  if (!blog?.root) return null;
  if (blog.journal) {
    const { journal } = await client.documents.findById({ id });
    if (journal !== blog.journal) return null;
  }
  return {
    root: blog.root,
    target: { ...DEFAULT_BLOG_TARGET, ...blog.target } as PublishTarget,
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
    exportNotes: ({ dest, ...opts }) => client.export.export(dest, opts),
    rebuildDerived: () => client.documents.rebuildDerived(),
    resetLibrary: async () => {
      await client.documents.deleteAll();
      await client.journals.ensureDefault();
    },
    backups,
    publishStatus: async ({ id }) => {
      const blog = await blogFor(client, id);
      return blog ? client.publish.status(id, blog.root, blog.target) : null;
    },
    publishNote: async ({ id }) => {
      const blog = await blogFor(client, id);
      if (!blog) {
        throw new Error(
          "[PUBLISH_NOT_CONFIGURED] Set a blog folder in Preferences first",
        );
      }
      return client.publish.publish(id, blog.root, blog.target);
    },
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
