import { ipcRenderer } from "electron";
import { Client } from "./client";

let client: Client | undefined;

ipcRenderer.invoke("server:gimme").then((port) => {
  client = new Client(`http://localhost:${port}`);
});

export async function getClient() {
  // todo: observable would probably be easier / faster
  while (!client) {
    await new Promise((r) => setTimeout(r, 100));
  }

  return client;
}
