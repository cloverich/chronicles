import React from "react";
// todo: feels a bit like this should be provided via context
import client, { Client } from "./client";
import { JournalResponse } from "./api/client/journals";

export function useJournals() {
  const [journals, setJournals] = React.useState<JournalResponse[]>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const journals = await client.v2.journals.list();
        if (!isEffectMounted) return;

        setJournals(journals);
        setLoading(false);
      } catch (err) {
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

  return { journals, loading, loadingErr };
}
