import path from "path";
import type { NotesClient } from "../../contract/notes";
import type { Settings } from "../../electron/settings";
import type {
  Maintenance,
  PublishAvailability,
} from "../../hooks/useMaintenance";
import type { Settings as SettingsFacade } from "../../hooks/useSettings";
import {
  BLOG_TARGET_DEFAULTS,
  publishSlug,
  type PublishTarget,
} from "../../markdown/publishProjection";
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

type BlogConfig =
  { root: string; journal: string; target: PublishTarget } | { reason: string };

/** The blog preference, or why publishing is unavailable. */
async function blogConfig(client: NodeClient): Promise<BlogConfig> {
  const blog = (await client.preferences.get("blog")) as IPreferences["blog"];
  if (!blog?.root) {
    return { reason: "Choose a blog folder in Preferences > Blog" };
  }
  if (!blog.journal) {
    return { reason: "Choose a blog journal in Preferences > Blog" };
  }
  return {
    root: blog.root,
    journal: blog.journal,
    target: { ...BLOG_TARGET_DEFAULTS, ...blog.target } as PublishTarget,
  };
}

/**
 * A note may be published when it is in the blog journal, or already has a
 * post (moving a published note out of the journal doesn't strand its post).
 */
async function noteStatus(
  client: NodeClient,
  id: string,
): Promise<PublishAvailability> {
  const blog = await blogConfig(client);
  if ("reason" in blog) return { state: "unavailable", reason: blog.reason };
  const status = await client.publish.status(id, blog.root, blog.target);
  const { journal } = await client.documents.findById({ id });
  if (
    status.state === "draft" &&
    journal.toLowerCase() !== blog.journal.toLowerCase()
  ) {
    return {
      state: "unavailable",
      reason: `Move this note to the ${blog.journal} journal to publish it`,
    };
  }
  return status;
}

/**
 * Write `slug` and `date` into the note when missing (spec/publish.md step 1).
 * The editor pins first to keep its open copy current; this covers publishing
 * from the Blog view.
 */
async function pinPublishPath(client: NodeClient, id: string) {
  const doc = await client.documents.findById({ id });
  const fm = doc.frontMatter as Record<string, unknown>;
  const hasSlug = typeof fm.slug === "string" && !!fm.slug;
  const hasDate = typeof fm.date === "string" && !!fm.date;
  if (hasSlug && hasDate) return;
  const slug = publishSlug({ title: doc.frontMatter.title, frontMatter: {} });
  await client.documents.updateDocument({
    id,
    journal: doc.journal,
    content: doc.content,
    frontMatter: {
      ...doc.frontMatter,
      ...(!hasSlug && slug ? { slug } : {}),
      ...(!hasDate ? { date: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    },
  });
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
    publishStatus: ({ id }) => noteStatus(client, id),
    publishNote: async ({ id }) => {
      const status = await noteStatus(client, id);
      const blog = await blogConfig(client);
      if (status.state === "unavailable" || "reason" in blog) {
        throw new Error(
          `[PUBLISH_NOT_CONFIGURED] ${"reason" in status ? status.reason : ""}`,
        );
      }
      await pinPublishPath(client, id);
      return client.publish.publish(id, blog.root, blog.target);
    },
    blogOverview: async () => {
      const blog = await blogConfig(client);
      if ("reason" in blog) return { configured: false, reason: blog.reason };
      return {
        configured: true,
        root: blog.root,
        journal: blog.journal,
        rows: await client.publish.overview(
          blog.journal,
          blog.root,
          blog.target,
        ),
      };
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
