import React from "react";
// todo: feels a bit like this should be provided via context
import client, { Client } from "./client";
import { JournalResponse } from "./api/client/journals";

export class JournalsStore {
  journals: JournalResponse[];
  constructor(journals: JournalResponse[]) {
    this.journals = journals;
  }

  static async create() {
    const journals = await client.v2.journals.list();
    return new JournalsStore(journals);
  }

  idForName = (name: string) => {
    const nameLower = name.toLowerCase();
    const match = this.journals.find((j) => j.name === nameLower);
    if (match) return match.id;
  };
}

export const JournalsStoreContext = React.createContext<JournalsStore>(
  null as any
);

export function useJournals() {
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
