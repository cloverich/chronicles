import { ipcRenderer } from "electron";
import { IPreferences } from "../hooks/stores/preferences";

export class SettingsStore {
  async get<K extends keyof IPreferences>(
    key: K,
  ): Promise<IPreferences[K] | undefined> {
    return await ipcRenderer.invoke("settings-get", key);
  }

  async set<K extends keyof IPreferences>(
    key: K,
    value: IPreferences[K],
  ): Promise<void> {
    await ipcRenderer.invoke("settings-set", key, value);
  }

  async delete<K extends keyof IPreferences>(key: K): Promise<void> {
    await ipcRenderer.invoke("settings-delete", key);
  }

  async clear(): Promise<void> {
    await ipcRenderer.invoke("settings-clear");
  }

  async getStore(): Promise<IPreferences> {
    return await ipcRenderer.invoke("settings-get-store");
  }

  async getPath(): Promise<string> {
    return await ipcRenderer.invoke("settings-get-path");
  }

  // For backwards compatibility - returns the actual store object
  get store(): Promise<IPreferences> {
    return this.getStore();
  }

  get path(): Promise<string> {
    return this.getPath();
  }
}

export const settings = new SettingsStore();
