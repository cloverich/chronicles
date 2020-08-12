import { ipcRenderer } from "electron";
import client, { Client } from "./client";

let isConfigured: boolean = false;

ipcRenderer.invoke("server:gimme").then((port) => {
  client.configure(`http://localhost:${port}`);
  isConfigured = true;
});

export async function getClient() {
  // todo: observable would probably be easier / faster
  // todo: yup its easier. now I could re-write this but...
  // ... que hueva
  while (!isConfigured) {
    await new Promise((r) => setTimeout(r, 100));
  }

  return client;
}
