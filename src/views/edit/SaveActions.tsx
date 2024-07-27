import React from "react";
import { Pane, Button } from "evergreen-ui";
import { EditableDocument } from "./EditableDocument";
import { Icons } from "../../components/icons";
import { useIsMounted } from "../../hooks/useIsMounted";
import { useNavigate } from "react-router-dom";
import { useSearchStore } from "../documents/SearchStore";

/**
 * Holds the Saving status and Delete button
 * todo: Move this to toolbar (drop saving button, its always auto-save)
 */
export function SaveActions({ document }: { document: EditableDocument }) {
  const isMounted = useIsMounted();
  const navigate = useNavigate();
  const searchStore = useSearchStore()!;

  async function deleteDocument() {
    if (confirm("Are you sure?")) {
      await document.del();
      searchStore.updateSearch(document, "del");
      if (isMounted()) navigate(-1);
    }
  }

  return (
    <Pane marginTop={24} display="flex" justifyContent="flex-end">
      <Button
        onClick={() => document.save()}
        disabled={!document.dirty}
        isLoading={document.saving}
      >
        {document.saving ? "Saving" : document.dirty ? "Save" : "Saved"}
      </Button>
      <Button marginLeft={16} onClick={deleteDocument} intent="danger">
        <Icons.delete size={18} />
      </Button>
    </Pane>
  );
}
