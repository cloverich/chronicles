import React from "react";
import { JournalResponse } from "../../preload/client/journals";
import useClient from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";
import { SearchV2Store } from "../documents/SearchStore";
import { JournalsStore } from "../../hooks/stores/journals";

/**
 * Determines the default journal to use when creating a new document.
 *
 * todo(test): When one or multiple journals are selected, returns the first
 * todo(test): When no journals are selected, returns the first active journal
 * todo(test): When archived journal selected, returns the selected (archived) journal
 */
function defaultJournal(selectedJournals: string[], jstore: JournalsStore) {
  const selectedId = jstore.journals.find((j) =>
    selectedJournals.includes(j.name),
  )?.id;

  if (selectedId) {
    return selectedId;
  } else {
    // todo: defaulting to first journal, but could use logic such as the last selected
    // journal, etc, once that is in place
    return jstore.active[0].id;
  }
}

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(
  search: SearchV2Store,
  jstore: JournalsStore,
  documentId?: string,
) {
  const [document, setDocument] = React.useState<EditableDocument | null>(null);
  const [loadingError, setLoadingError] = React.useState<Error | null>(null);
  const client = useClient();

  // (Re)load document based on documentId
  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      setLoadingError(null);

      try {
        // if documentId -> This is an existing document
        if (documentId) {
          const doc = await client.documents.findById({ documentId });
          if (!isEffectMounted) return;
          setDocument(new EditableDocument(client, doc));
        } else {
          // new documents
          setDocument(
            new EditableDocument(client, {
              content: "",
              journalId: defaultJournal(search.selectedJournals, jstore),
            }),
          );
        }
      } catch (err) {
        if (!isEffectMounted) return;
        setLoadingError(err as Error);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
      if (document?.teardown) document.teardown();
    };
  }, [documentId]);

  return {
    document,
    loadingError: loadingError,
  };
}
