import { contextBridge } from "electron";
import { getClient } from "./client";
import "./utils.electron";
import {
  importThemeFile,
  openDialogSelectDir,
  selectThemeFile,
} from "./utils.electron";

contextBridge.exposeInMainWorld("chronicles", {
  getClient,
  openDialogSelectDir,
  selectThemeFile,
  importThemeFile,
});

declare global {
  interface Window {
    chronicles: {
      getClient: typeof getClient;
      openDialogSelectDir: typeof openDialogSelectDir;
      selectThemeFile: typeof selectThemeFile;
      importThemeFile: typeof importThemeFile;
    };
  }
}
