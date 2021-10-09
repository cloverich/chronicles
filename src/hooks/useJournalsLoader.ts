import React from "react";
import { JournalsStore } from "./stores/journals";
import { JournalResponse } from "../preload/client/journals";
import client from "../client";

export const JournalsStoreContext = React.createContext<JournalsStore>(
  // This cast combines with the top-level container ensuring journals are loaded,
  // so all downstream components that need journals (most of the app) can rely
  // on them being preloaded and avoid the null checks
  null as any
);

/**
 * Loads this journal store. After loading it should be passed down in context
 */
export function useJournalsLoader() {
  const [journals, setJournals] = React.useState<JournalResponse[]>();
  const [journalsStore, setJournalsStore] = React.useState<JournalsStore>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const journalStore = await JournalsStore.create();
        const journals = await client.v2.journals.list();
        if (!isEffectMounted) return;

        setJournals(journals);
        setJournalsStore(journalStore);
        setLoading(false);
      } catch (err: any) {
        if (!isEffectMounted) return;

        setLoadingErr(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  return { journals, journalsStore, loading, loadingErr };
}
