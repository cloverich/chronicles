import { useEffect, useState } from "react";
import { Preferences } from "./stores/preferences";
import { useApplicationStore } from "./useApplicationStore";
import useClient from "./useClient";

export interface PreferencesSetupState {
  loading: boolean;
  loadingErr: Error | null;
  preferences: Preferences | null;
}

let wasAlreadyCalled = false;

export const usePreferencesSetup = () => {
  const client = useClient();
  const [loading, setLoading] = useState(true);
  // const [loadingErr, setLoadingErr] = useState<Error | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // watch for preferences updates
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      if (wasAlreadyCalled) {
        console.warn(
          "WARNING: usePreferencesSetup is being called or used more than once, check usePreferencesSetup usage to ensure its only called one time",
        );
        return;
      }
      wasAlreadyCalled = true;

      const preferences = await Preferences.init(client.preferences);
      document.documentElement.addEventListener(
        "settingsUpdated",
        preferences.refresh,
      );
      setLoading(false);
      setPreferences(preferences);

      cleanup = () => {
        document.documentElement.removeEventListener(
          "settingsUpdated",
          preferences?.refresh,
        );
      };
    })();

    return () => {
      cleanup?.();
    };
  }, []);

  return {
    loading,
    preferences,
  };
};

export const usePreferences = (): Preferences => {
  const appState = useApplicationStore();
  return appState.preferences;
};
