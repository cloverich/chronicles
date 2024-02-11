import { contextBridge } from "electron";
import { create } from "./client";
import "./utils.electron";

contextBridge.exposeInMainWorld("chronicles", {
  createClient: create,
});
