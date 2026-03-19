import { BrowserView, ContextMenu, Utils } from "electrobun/bun";
import { createClient } from "../bun-client/factory";
import {
  getFontsCSSStylesheetHref,
  listInstalledFonts,
  refreshFontsCSSFile,
} from "../fonts/loader";
import { listHljsThemes, loadHljsThemeCSS } from "../themes/hljs";
import { importThemeFile } from "../themes/importer";
import {
  deleteThemeByName,
  listAvailableThemes,
  loadThemeByName,
} from "../themes/loader";
import type { ChroniclesRPC, ClientModule } from "./rpc-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = Record<string, any>;

let client: AnyClient | null = null;

async function getOrCreateClient(): Promise<AnyClient> {
  if (client) return client;

  // TODO: In production, these paths should come from user preferences
  // or Electrobun's PATHS API. For dev, use env vars.
  const notesDir =
    process.env.CHRONICLES_NOTES_DIR || `${process.env.HOME}/chronicles-notes`;
  const settingsDir = process.env.CHRONICLES_SETTINGS_DIR || notesDir;
  const dbPath =
    process.env.CHRONICLES_DB_PATH || `${settingsDir}/chronicles.db`;

  // Cast to AnyClient — BunClient interface doesn't expose all sub-modules
  // (e.g. files), but the runtime object does include them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client = (await createClient({ dbPath, notesDir, settingsDir })) as any;
  return client!;
}

function getSettingsDir(): string {
  return (
    process.env.CHRONICLES_SETTINGS_DIR ||
    process.env.CHRONICLES_NOTES_DIR ||
    `${process.env.HOME}/chronicles-notes`
  );
}

function getThemesDir(): string {
  return `${getSettingsDir()}/themes`;
}

function getFontsDir(): string {
  return `${getSettingsDir()}/fonts`;
}

export function createRPC() {
  return BrowserView.defineRPC<ChroniclesRPC>({
    maxRequestTime: 30000, // 30s for slow operations (indexing, import)
    handlers: {
      // Cast to any to avoid index-signature incompatibility between the typed
      // handler object and Electrobun's RPCRequestHandlerObject constraint.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requests: {
        clientCall: async ({
          module,
          method,
          args,
        }: {
          module: ClientModule;
          method: string;
          args: unknown[];
        }) => {
          const c = await getOrCreateClient();
          const mod = c[module];
          if (!mod) throw new Error(`Unknown client module: ${module}`);
          const fn = mod[method];
          if (typeof fn !== "function") {
            throw new Error(`Unknown method: ${module}.${method}`);
          }
          return await fn.apply(mod, args);
        },

        openDialogSelectDir: async () => {
          try {
            const paths = await Utils.openFileDialog({
              canChooseFiles: false,
              canChooseDirectory: true,
              allowsMultipleSelection: false,
            });
            const value = paths?.[0] || undefined;
            return { value, error: undefined };
          } catch (err) {
            return { value: undefined, error: String(err) };
          }
        },

        selectThemeFile: async () => {
          try {
            const paths = await Utils.openFileDialog({
              canChooseFiles: true,
              canChooseDirectory: false,
              allowsMultipleSelection: false,
              allowedFileTypes: "json",
            });
            const value = paths?.[0] || undefined;
            return { value, error: undefined };
          } catch (err) {
            return { value: undefined, error: String(err) };
          }
        },

        importThemeFile: async ({
          filePath,
          themesDir,
        }: {
          filePath: string;
          themesDir: string;
        }) => {
          return importThemeFile(filePath, themesDir);
        },

        listAvailableThemes: async ({ themesDir }: { themesDir: string }) => {
          return listAvailableThemes(themesDir);
        },

        loadThemeByName: async ({
          name,
          themesDir,
        }: {
          name: string;
          themesDir: string;
        }) => {
          return loadThemeByName(name, themesDir) ?? null;
        },

        deleteThemeByName: async ({
          name,
          themesDir,
        }: {
          name: string;
          themesDir: string;
        }) => {
          return deleteThemeByName(name, themesDir);
        },

        listHljsThemes: async () => {
          return listHljsThemes();
        },

        loadHljsThemeCSS: async ({ name }: { name: string }) => {
          return loadHljsThemeCSS(name) ?? null;
        },

        listInstalledFonts: async () => {
          return listInstalledFonts(getFontsDir());
        },

        getInstalledFontsStylesheetHref: async () => {
          return getFontsCSSStylesheetHref(getFontsDir());
        },

        refreshInstalledFontsCache: async () => {
          return refreshFontsCSSFile(getFontsDir());
        },

        openPath: async ({ dirPath }: { dirPath: string }) => {
          Utils.openPath(dirPath);
        },

        setNativeTheme: async (_params: {
          theme: "light" | "dark" | "system";
        }) => {
          // TODO: Electrobun v1 doesn't have an equivalent to Electron's
          // nativeTheme.themeSource. The renderer can detect system theme via
          // window.matchMedia("(prefers-color-scheme: dark)") instead.
          return false;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      messages: {
        showContextMenu: ({ x, y }: { x: number; y: number }) => {
          ContextMenu.showContextMenu([
            { label: "Cut", role: "cut" },
            { label: "Copy", role: "copy" },
            { label: "Paste", role: "paste" },
            { type: "separator" },
            { label: "Select All", role: "selectAll" },
          ]);
        },
      },
    },
  });
}
