import { toaster } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useClient from "../../hooks/useClient";
import { useIsMounted } from "../../hooks/useIsMounted";
import { useJournals } from "../../hooks/useJournals";
import { SearchStoreContext } from "../documents/SearchStore";
import { EditLoadingComponent } from "../edit/loading";

// Creates a new document and immediately navigates to it; re-directs back to
// /documents if no journals are available
function useCreateDocument() {
  const journalsStore = useJournals();

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
  function defaultJournal(selectedJournals: string[]): string | null {
    // pre-select the first journal if any are active in the search
    const selected = journalsStore.journals.find((j) =>
      selectedJournals.includes(j.name),
    )?.name;

    if (selected) {
      return selected;
    } else {
      // Otherwise use the default journal, or the first active journal
      const defaultJournal = journalsStore.defaultJournal;
      if (defaultJournal) return defaultJournal;

      // Fallback behavior
      if (!journalsStore.active.length) {
        return null;
      }

      return journalsStore.active[0].name;
    }
  }

  useEffect(() => {
    (async function () {
      if (!isMounted) return;

      const journal = defaultJournal(searchStore.selectedJournals);

      // edge case: no journals, all journals archived, failed sync
      // etc. Shouldn't happen, but better to have fallback behavior
      // than be stuck.
      if (!journal) {
        navigate("/documents");
        toaster.warning("No journals available to create a document");
        return;
      }

      try {
        const document = {
          content: "",
          journal: journal,
          frontMatter: {
            title: undefined,
            tags: searchStore.selectedTags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };

        const [id, _] = await client.documents.createDocument(document);

        if (!isMounted) return;

        // Ensure the document is added to the search, so its available when user hits
        // back (even when that doesn't make sense!)
        searchStore.updateSearch({ ...document, id }, "create");
        navigate(`/documents/edit/${id}`, { replace: true });
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
