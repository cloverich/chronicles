import { observable } from "mobx";
import React from "react";
import { toast } from "sonner";
import { JournalsStore } from "./stores/journals";
import { Preferences } from "./stores/preferences";
import useClient from "./useClient";
import { usePreferencesSetup } from "./usePreferences";

export const ApplicationContext = React.createContext<ApplicationState | null>(
  null,
);

// todo: Allow selecting part of state
export function useApplicationState() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore;
}

let wasAlreadyCalled = false;

class ApplicationState {
  preferences: Preferences;
  journals: JournalsStore;

  @observable
  isPreferencesOpen: boolean;

  constructor(preferences: Preferences, journals: JournalsStore) {
    this.preferences = preferences;
    this.journals = journals;
    this.isPreferencesOpen = false;
  }

  togglePreferences = (state: boolean) => {
    if (state) {
      this.isPreferencesOpen = state;
    } else {
      this.isPreferencesOpen = !this.isPreferencesOpen;
    }
  };
}

interface IApplicationState {
  loading: boolean;
  loadingErr: Error | null;
  applicationStore: null | ApplicationState;
}

/**
 * Runs sync and loads the journal store. After loading it should be passed down in context.
 * Could put other application loading state here.
 */
export function useAppLoader(): IApplicationState {
  const [journalsStore, setJournalsStore] = React.useState<JournalsStore>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);
  const client = useClient();
  const { preferences, loading: prefsLoading } = usePreferencesSetup();
  const [applicationStore, setApplicationStore] =
    React.useState<ApplicationState | null>(null);

  React.useEffect(() => {
    if (wasAlreadyCalled) {
      console.warn(
        "WARNING: useAppLoader is being called or used more than once, check useAppLoder usage to ensure its only called one time",
      );
      return;
    }
    wasAlreadyCalled = true;

    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      let toastId = null;

      try {
        if (await client.sync.needsSync()) {
          toastId = toast("Syncing notes database", {
            duration: Infinity,
          });

          await client.sync.sync();

          toast.dismiss(toastId);
        }
      } catch (err: any) {
        if (toastId) toast.dismiss(toastId);

        console.error("error syncing at startup", err);
        setLoadingErr(err);
        setLoading(false);
        return;
      }

      try {
        const journalStore = await JournalsStore.init(client);

        if (!isEffectMounted) return;

        setJournalsStore(journalStore);
        setLoading(false);
      } catch (err: any) {
        if (!isEffectMounted) return;
        console.error("error creating journal store", err);
        setLoadingErr(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (loading || loadingErr || !journalsStore || !preferences) return;
    if (applicationStore) return;

    setApplicationStore(new ApplicationState(preferences, journalsStore));
  }, [loading, loadingErr, journalsStore, preferences]);

  return {
    loading: loading,
    loadingErr: loadingErr,
    applicationStore: applicationStore,
  };
}
