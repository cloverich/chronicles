import { observable } from "mobx";
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useClient from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";

interface LoodingState {
  document: EditableDocument | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(documentId?: string) {
  const navigate = useNavigate();
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

      // NOTE: If this navigation removed, MUST review consumption of useEditableDocument
      // to ensure missing documentId is handled correctly.
      if (!documentId) {
        navigate("/documents");
        toast.warning(`Document ${documentId} not found`);
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
        const message = err instanceof Error ? err.message : String(err);

        if (message.match(/not found/)) {
          navigate("/documents");
          toast.warning(`Document ${documentId} not found`);
        } else {
          state.error = err as Error;
        }
      }
    }

    load();
    return () => {
      if (state.document?.teardown) {
        console.log(
          `save count for ${state.document.id}: ${state.document.saveCount}`,
        );
        state.document.teardown();
      }
      if (state.document?.saveCount)
        console.log("saved", state.document.saveCount, "times");
    };
  }, [documentId]);

  return state;
}
