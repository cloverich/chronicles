import React from "react";
import { JournalsStore } from "./stores/journals";
import { JournalResponse } from "../preload/client/journals";
import useClient from "./useClient";

export const JournalsStoreContext = React.createContext<JournalsStore | null>(
  null,
);

/**
 * Loads this journal store. After loading it should be passed down in context
 */
export function useJournalsLoader() {
  const [journals, setJournals] = React.useState<JournalResponse[]>();
  const [journalsStore, setJournalsStore] = React.useState<JournalsStore>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);
  const client = useClient();

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const journalStore = await JournalsStore.create(client);
        const journals = await client.journals.list();
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
