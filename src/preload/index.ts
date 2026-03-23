import { contextBridge } from "electron";
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

contextBridge.exposeInMainWorld("chronicles", {
  getClient,
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
      getClient: typeof getClient;
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
