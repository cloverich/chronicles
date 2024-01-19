import React from "react";
import { JournalResponse } from "../../preload/client/journals";
import useClient from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(
  journals: JournalResponse[],
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
              // todo: defaulting to first journal, but could use logic such as the last selected
              // journal, etc, once that is in place
              journalId: journals[0].id,
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
    journals,
    document,
    loadingError: loadingError,
  };
}
