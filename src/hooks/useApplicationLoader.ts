import React from "react";
import { BulkOperationsStore } from "./stores/BulkOperationsStore";
import type { IApplicationState } from "./stores/application";
import { ApplicationStore } from "./stores/application";
import { JournalsStore } from "./stores/journals";
import { MaintenanceStore } from "./stores/maintenance";
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
  const [maintenanceStore, setMaintenanceStore] =
    React.useState<MaintenanceStore>();
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
      try {
        const journalStore = await JournalsStore.init(client);
        const maintenanceStoreInstance = new MaintenanceStore(
          client,
          journalStore,
        );

        if (!isEffectMounted) return; // :thinkies?

        setJournalsStore(journalStore);
        setMaintenanceStore(maintenanceStoreInstance);
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
      !maintenanceStore ||
      !preferences ||
      !bulkOperationsStore
    )
      return;
    if (applicationStore) return;

    setApplicationStore(
      new ApplicationStore(
        preferences,
        journalsStore,
        maintenanceStore,
        bulkOperationsStore,
      ),
    );
  }, [loading, loadingErr, journalsStore, maintenanceStore, preferences]);

  return {
    loading: loading,
    loadingErr: loadingErr,
    applicationStore: applicationStore,
  };
}
