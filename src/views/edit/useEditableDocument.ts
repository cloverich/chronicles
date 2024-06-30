import React from "react";
import useClient from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(documentId: string) {
  const [document, setDocument] = React.useState<EditableDocument | null>(null);
  const [loadingError, setLoadingError] = React.useState<Error | null>(null);
  const client = useClient();

  // (Re)load document based on documentId
  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      setLoadingError(null);

      if (!documentId) {
        // Fail safe; this shuldn't happen. If scenarios come up where it could; maybe toast and navigate
        // to documents list instead?
        setLoadingError(
          new Error(
            "Called useEditableDocument without a documentId, unable to load document",
          ),
        );
        return;
      }

      try {
        const doc = await client.documents.findById({ id: documentId });
        if (!isEffectMounted) return;
        setDocument(new EditableDocument(client, doc));
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
