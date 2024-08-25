import React from "react";
import useClient from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";
import { observable } from "mobx";

interface LoodingState {
  document: EditableDocument | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(documentId: string) {
  const client = useClient();
  const [state, _] = React.useState<LoodingState>(() => {
    return observable({
      document: null,
      loading: true,
      error: null,
    });
  });

  // (Re)load document based on documentId
  React.useEffect(() => {
    state.loading = true;

    let isEffectMounted = true;
    async function load() {
      state.error = null;

      if (!documentId) {
        // Fail safe; this shuldn't happen. If scenarios come up where it could; maybe toast and navigate
        // to documents list instead?
        state.error = new Error(
          "Called useEditableDocument without a documentId, unable to load document",
        );

        return;
      }

      try {
        const doc = await client.documents.findById({ id: documentId });
        if (!isEffectMounted) return;
        state.document = new EditableDocument(client, doc);

        // Loading is instantaneous and the loading = true | false transition which the edit/view depends on never
        // happens; insert an artifical delay (hack).
        setTimeout(() => {
          state.loading = false;
        });
      } catch (err) {
        state.error = err as Error;
      }
    }

    load();
    return () => {
      if (state.document?.teardown) state.document.teardown();
    };
  }, [documentId]);

  return state;
}
