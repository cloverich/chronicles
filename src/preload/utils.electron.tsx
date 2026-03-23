// In renderer process (web page).
import { ipcRenderer } from "electron";
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

// todo: Probably this should exposeInMainWorld a function
// to do the inspect-element via middle click, then let the actual
// browser code setup the window.onauxclick...
// Map middle click to "inspect element" for debugging
window.onauxclick = (e) => {
  // apparently button 1 is middle click
  if (e.button !== 1) return;
  ipcRenderer.send("inspect-element", { x: e.x, y: e.y });
};

interface SelectDirResult {
  error?: string;
  value?: string;
}

export const openDialogSelectDir = async () => {
  ipcRenderer.send("select-directory");

  return new Promise<SelectDirResult>((resolve, reject) => {
    ipcRenderer.once("directory-selected", (event, arg: SelectDirResult) => {
      if (arg.error) {
        reject(arg.error);
      } else if (!arg.value) {
        resolve({ value: undefined });
      } else {
        // this.set("notesDir", arg.value);
        resolve({ value: arg.value });
      }
    });
  });
};

interface SelectFileResult {
  error?: string;
  value?: string;
}

export const selectThemeFile = async () => {
  ipcRenderer.send("select-theme-file");

  return new Promise<SelectFileResult>((resolve, reject) => {
    ipcRenderer.once("theme-file-selected", (event, arg: SelectFileResult) => {
      if (arg.error) {
        reject(arg.error);
      } else {
        resolve({ value: arg.value });
      }
    });
  });
};

export const openPath = (dirPath: string) => {
  ipcRenderer.send("open-path", dirPath);
};

/**
 * Set Electron's native theme and return whether dark colors should be used.
 * Synchronous so the renderer can immediately resolve "system" mode.
 */
export const setNativeTheme = (theme: "light" | "dark" | "system"): boolean => {
  return ipcRenderer.sendSync("set-native-theme", theme);
};

export {
  deleteThemeByName,
  getFontsCSSStylesheetHref as getInstalledFontsStylesheetHref,
  importThemeFile,
  listAvailableThemes,
  listHljsThemes,
  listInstalledFonts,
  loadHljsThemeCSS,
  loadThemeByName,
  refreshFontsCSSFile as refreshInstalledFontsCache,
};
