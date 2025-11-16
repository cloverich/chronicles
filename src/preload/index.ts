import { contextBridge } from "electron";
import { getClient } from "./client";
import "./utils.electron";
import { openDialogSelectDir } from "./utils.electron";

contextBridge.exposeInMainWorld("chronicles", {
  getClient,
  openDialogSelectDir,
});

declare global {
  interface Window {
    chronicles: {
      getClient: typeof getClient;
      openDialogSelectDir: typeof openDialogSelectDir;
    };
  }
}
