import { useState, useEffect, useContext } from "react";
import { JournalsContext } from "./useJournals";

/**
 * Get a single journal by name.
 *
 * Requires the store be loaded with journals first, but will helpfully throw an error
 * and blow up the UI if it hasn't.
 *
 * @param journalName
 */
export function useJournal(journalName: string) {
  const store = useContext(JournalsContext);
  const [journal, setJournal] = useState(() =>
    store.journals.find((journal) => journal.name == journalName)
  );
  if (!journal)
    throw new Error(
      `useJournal called with ${journalName} but that journal was not found in the store. Instead found ${store.journals.map(
        (j) => j.name
      )}`
    );

  useEffect(() => {
    setJournal(store.journals.find((journal) => journal.name == journalName));
  }, [journalName]);

  return journal;
}
