import { contextBridge } from "electron";
import { create } from "./client";

import { listenLinks } from "./utils.electron";
listenLinks();

contextBridge.exposeInMainWorld("chronicles", {
  createClient: create,
});
