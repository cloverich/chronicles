import React, { useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { EditLoadingComponent } from "../edit/loading";
import { useIsMounted } from "../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { useNavigate } from "react-router-dom";
import { SearchStoreContext } from "../documents/SearchStore";
import useClient from "../../hooks/useClient";

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

  useEffect(() => {
    (async function () {
      if (!isMounted) return;

      try {
        const document = await client.documents.save({
          content: "",
          journalId: journalsStore.defaultJournal(searchStore.selectedJournals),
          tags: [], // todo: tagsStore.defaultTags;
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
