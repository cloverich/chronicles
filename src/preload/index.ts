import { contextBridge } from "electron";
import { getClient } from "./client";
import "./utils.electron";
import {
  deleteThemeByName,
  importThemeFile,
  listAvailableThemes,
  loadThemeByName,
  openDialogSelectDir,
  openPath,
  selectThemeFile,
} from "./utils.electron";

contextBridge.exposeInMainWorld("chronicles", {
  getClient,
  openDialogSelectDir,
  selectThemeFile,
  importThemeFile,
  listAvailableThemes,
  loadThemeByName,
  openPath,
  deleteThemeByName,
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
      openPath: typeof openPath;
      deleteThemeByName: typeof deleteThemeByName;
    };
  }
}
