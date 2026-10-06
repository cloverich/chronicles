import React, { useContext } from "react";
import type { IPreferences } from "../electron/preferences-types";

export type { IPreferences };

/**
 * Per-device app settings (appearance, folders, default journal). Library
 * data never goes here. The host enforces its own rules on write — Electron
 * rejects a notesDir inside a sync-service folder — and errors arrive as
 * NotesErrors (see `hydrateService`).
 */
export interface Settings {
  get<K extends keyof IPreferences>(key: K): Promise<IPreferences[K]>;
  all(): Promise<IPreferences>;
  setMany(partial: Partial<IPreferences>): Promise<void>;
  /** Where the host keeps settings (a file path on Electron), for display. */
  location(): Promise<string>;
}

export const SettingsContext = React.createContext<Settings | null>(null);
SettingsContext.displayName = "SettingsContext";

export function useSettings(): Settings {
  const settings = useContext(SettingsContext);
  if (!settings) {
    throw new Error(
      "[chronicles] useSettings() called outside a SettingsContext",
    );
  }
  return settings;
}
