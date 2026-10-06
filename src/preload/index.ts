import { contextBridge } from "electron";
import type { NotesClient } from "../contract/notes";
import { exposeNotesClient, exposeService } from "../contract/transport";
import type { Maintenance } from "../hooks/useMaintenance";
import type { Settings } from "../hooks/useSettings";
import { getHost, initHost } from "./client";
import "./utils.electron";
import {
  deleteThemeByName,
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

// Open the library eagerly; the renderer waits on ready().
initHost().catch((err) => {
  console.error("[chronicles] Failed to open the library:", err);
});

const notesClient = exposeNotesClient(() => getHost().notes);

contextBridge.exposeInMainWorld("chronicles", {
  /**
   * Resolves once the database is open and migrated (which can take a while
   * on the first launch after an upgrade); rejects with the reason it failed.
   * Call before any get*() service accessor.
   */
  ready: () => initHost().then(() => undefined),
  getNotesClient: () => notesClient,
  getSettings: () => exposeService(getHost().settings),
  getMaintenance: () => exposeService(getHost().maintenance),
  openDialogSelectDir,
  selectThemeFile,
  importThemeFile,
  listAvailableThemes,
  loadThemeByName,
  listInstalledFonts,
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
      getNotesClient: () => NotesClient;
      getSettings: () => Settings;
      getMaintenance: () => Maintenance;
      openDialogSelectDir: typeof openDialogSelectDir;
      selectThemeFile: typeof selectThemeFile;
      importThemeFile: typeof importThemeFile;
      listAvailableThemes: typeof listAvailableThemes;
      loadThemeByName: typeof loadThemeByName;
      listInstalledFonts: typeof listInstalledFonts;
      refreshInstalledFontsCache: typeof refreshInstalledFontsCache;
      openPath: typeof openPath;
      setNativeTheme: typeof setNativeTheme;
      deleteThemeByName: typeof deleteThemeByName;
      listHljsThemes: typeof listHljsThemes;
      loadHljsThemeCSS: typeof loadHljsThemeCSS;
    };
  }
}
