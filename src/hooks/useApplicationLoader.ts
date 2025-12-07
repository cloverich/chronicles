import React from "react";
import { toast } from "sonner";
import { BulkOperationsStore } from "./stores/BulkOperationsStore";
import { ApplicationStore, IApplicationState } from "./stores/application";
import { JournalsStore } from "./stores/journals";
import { SyncStore } from "./stores/sync";
import useClient from "./useClient";
import { usePreferencesSetup } from "./usePreferences";

let wasAlreadyCalled = false;

/**
 * Runs sync and loads the journal store. After loading it should be passed down in context.
 * Could put other application loading state here.
 */
export function useAppLoader(): IApplicationState {
  const [journalsStore, setJournalsStore] = React.useState<JournalsStore>();
  const [bulkOperationsStore, setBulkOperationsStore] =
    React.useState<BulkOperationsStore>();
  const [syncStore, setSyncStore] = React.useState<SyncStore>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);
  const client = useClient();
  const { preferences } = usePreferencesSetup();
  const [applicationStore, setApplicationStore] =
    React.useState<ApplicationStore | null>(null);

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

        const syncStoreInstance = new SyncStore(client, journalStore);
        setJournalsStore(journalStore);
        setSyncStore(syncStoreInstance);
        setBulkOperationsStore(new BulkOperationsStore(client.bulkOperations));
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
    if (
      loading ||
      loadingErr ||
      !journalsStore ||
      !syncStore ||
      !preferences ||
      !bulkOperationsStore
    )
      return;
    if (applicationStore) return;

    setApplicationStore(
      new ApplicationStore(
        preferences,
        journalsStore,
        syncStore,
        bulkOperationsStore,
      ),
    );
  }, [loading, loadingErr, journalsStore, syncStore, preferences]);

  return {
    loading: loading,
    loadingErr: loadingErr,
    applicationStore: applicationStore,
  };
}
