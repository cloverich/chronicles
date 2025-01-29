import { observable } from "mobx";
import React from "react";
import { toast } from "sonner";
import { JournalsStore } from "./stores/journals";
import useClient from "./useClient";

interface PreferencesUiState {
  isOpen: boolean;
  toggle: (state: boolean) => void;
}

export interface ApplicationState {
  preferences: PreferencesUiState;
  journals: JournalsStore;
}

export const ApplicationContext = React.createContext<ApplicationState | null>(
  null,
);

// todo: Allow selecting part of state
export function useApplicationState() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore;
}

/**
 * Runs sync and loads the journal store. After loading it should be passed down in context.
 * Could put other application loading state here.
 */
export function useAppLoader() {
  const [journalsStore, setJournalsStore] = React.useState<JournalsStore>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);
  const client = useClient();

  const [preferences] = React.useState<PreferencesUiState>(
    observable({
      isOpen: false,
      toggle: (state: boolean) => {
        if (state) {
          preferences.isOpen = state;
        } else {
          preferences.isOpen = !preferences.isOpen;
        }
      },
    }),
  );

  React.useEffect(() => {
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

  return { journals: journalsStore, loading, loadingErr, preferences };
}
