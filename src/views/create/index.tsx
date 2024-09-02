import { observer } from "mobx-react-lite";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useClient from "../../hooks/useClient";
import { useIsMounted } from "../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { SearchStoreContext } from "../documents/SearchStore";
import { EditLoadingComponent } from "../edit/loading";

// Creates a new document and immediately navigates to it
function useCreateDocument() {
  const journalsStore = useContext(JournalsStoreContext)!;

  // NOTE: Could move this hook but, but it assumes searchStore is defined, and its setup
  // in the root documents view. So better to keep it here for now.
  const searchStore = useContext(SearchStoreContext)!;
  const navigate = useNavigate();
  const client = useClient();
  const isMounted = useIsMounted();
  const [error, setError] = useState<Error | null>(null);

  /**
   * Determines the default journal to use when creating a new document.
   *
   * todo(test): When one or multiple journals are selected, returns the first
   * todo(test): When no journals are selected, returns the first active journal
   * todo(test): When archived journal selected, returns the selected (archived) journal
   */
  function defaultJournal(selectedJournals: string[]) {
    const selectedId = journalsStore.journals.find((j) =>
      selectedJournals.includes(j.name),
    )?.id;

    if (selectedId) {
      return selectedId;
    } else {
      const defaultId = journalsStore.defaultJournalId;
      if (defaultId) return defaultId;

      console.error(
        "No default journal set, using first active journal; set a default journal in preferences",
      );
      return journalsStore.active[0].id;
    }
  }

  useEffect(() => {
    (async function () {
      if (!isMounted) return;

      try {
        const document = await client.documents.save({
          content: "",
          journalId: defaultJournal(searchStore.selectedJournals),
          tags: searchStore.selectedTags,
        });

        if (!isMounted) return;

        // Ensure the document is added to the search, so its available when user hits
        // back (even when that doesn't make sense!)
        searchStore.updateSearch(document, "create");
        navigate(`/documents/edit/${document.id}`, { replace: true });
      } catch (err) {
        console.error("Error creating document", err);
        if (!isMounted) return;
        setError(err as Error);
      }
    })();
  }, []);

  return { error };
}

// Creates a new document and immediately navigates to it
function DocumentCreator() {
  const { error } = useCreateDocument();

  return <EditLoadingComponent error={error} />;
}

export default observer(DocumentCreator);
