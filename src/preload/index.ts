import { contextBridge } from "electron";
import { getClient } from "./client";
import "./utils.electron";
import {
  importThemeFile,
  listAvailableThemes,
  openDialogSelectDir,
  selectThemeFile,
} from "./utils.electron";

contextBridge.exposeInMainWorld("chronicles", {
  getClient,
  openDialogSelectDir,
  selectThemeFile,
  importThemeFile,
  listAvailableThemes,
});

declare global {
  interface Window {
    chronicles: {
      getClient: typeof getClient;
      openDialogSelectDir: typeof openDialogSelectDir;
      selectThemeFile: typeof selectThemeFile;
      importThemeFile: typeof importThemeFile;
      listAvailableThemes: typeof listAvailableThemes;
    };
  }
}
