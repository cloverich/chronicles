import { contextBridge } from "electron";
import type { NotesClient } from "../contract/notes";
import { exposeNotesClient } from "../contract/transport";
import { backups } from "./backups";
import { getClient, initClient } from "./client";
import "./utils.electron";
import {
  deleteThemeByName,
  getInstalledFontsStylesheetHref,
  importThemeFile,
  listAvailableThemes,
  listHljsThemes,
  listInstalledFonts,
  loadHljsThemeCSS,
  loadThemeByName,
  openDialogSelectDir,
  openPath,
  refreshInstalledFontsCache,
  selectThemeFile,
  setNativeTheme,
} from "./utils.electron";

// Kick off client initialization eagerly so it's ready when the renderer calls getClient()
initClient().catch((err) => {
  console.error("[chronicles] Failed to initialize client:", err);
});

const notesClient = exposeNotesClient(() => getClient().notes);

contextBridge.exposeInMainWorld("chronicles", {
  /**
   * Resolves once the database is open and migrated (which can take a while
   * on the first launch after an upgrade); rejects with the reason it failed.
   * Call before getClient()/getNotesClient().
   */
  ready: () => initClient().then(() => undefined),
  getClient,
  getNotesClient: () => notesClient,
  backups,
  openDialogSelectDir,
  selectThemeFile,
  importThemeFile,
  listAvailableThemes,
  loadThemeByName,
  listInstalledFonts,
  getInstalledFontsStylesheetHref,
  refreshInstalledFontsCache,
  openPath,
  setNativeTheme,
  deleteThemeByName,
  listHljsThemes,
  loadHljsThemeCSS,
});

declare global {
  interface Window {
    chronicles: {
      ready: () => Promise<void>;
      getClient: typeof getClient;
      getNotesClient: () => NotesClient;
      backups: typeof backups;
      openDialogSelectDir: typeof openDialogSelectDir;
      selectThemeFile: typeof selectThemeFile;
      importThemeFile: typeof importThemeFile;
      listAvailableThemes: typeof listAvailableThemes;
      loadThemeByName: typeof loadThemeByName;
      listInstalledFonts: typeof listInstalledFonts;
      getInstalledFontsStylesheetHref: typeof getInstalledFontsStylesheetHref;
      refreshInstalledFontsCache: typeof refreshInstalledFontsCache;
      openPath: typeof openPath;
      setNativeTheme: typeof setNativeTheme;
      deleteThemeByName: typeof deleteThemeByName;
      listHljsThemes: typeof listHljsThemes;
      loadHljsThemeCSS: typeof loadHljsThemeCSS;
    };
  }
}
