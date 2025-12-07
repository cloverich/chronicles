import React, { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { BulkOperationType } from "../../../preload/client/bulk-operations";
import { SearchStore } from "../SearchStore";
import { AddTagModal } from "./AddTagModal";
import { BulkOperationSelectorModal } from "./BulkOperationSelectorModal";
import { ChangeJournalModal } from "./ChangeJournalModal";
import { RemoveTagModal } from "./RemoveTagModal";

interface BulkOperationsProps {
  searchStore: SearchStore;
  hotkey?: string;
}

/**
 * Wrapper component that handles all bulk operation modals and hotkey setup.
 * Renders the selector modal and all operation-specific modals.
 */
export function BulkOperations({ searchStore, hotkey }: BulkOperationsProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [removeTagOpen, setRemoveTagOpen] = useState(false);
  const [changeJournalOpen, setChangeJournalOpen] = useState(false);

  useHotkeys(
    hotkey || "",
    () => {
      setSelectorOpen(true);
    },
    { enabled: !!hotkey },
  );

  const handleSelectOperation = (op: BulkOperationType) => {
    setSelectorOpen(false);
    switch (op) {
      case "add_tag":
        setAddTagOpen(true);
        break;
      case "remove_tag":
        setRemoveTagOpen(true);
        break;
      case "change_journal":
        setChangeJournalOpen(true);
        break;
    }
  };

  return (
    <>
      <BulkOperationSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectOperation={handleSelectOperation}
      />
      <AddTagModal
        open={addTagOpen}
        onClose={() => setAddTagOpen(false)}
        searchStore={searchStore}
      />
      <RemoveTagModal
        open={removeTagOpen}
        onClose={() => setRemoveTagOpen(false)}
        searchStore={searchStore}
      />
      <ChangeJournalModal
        open={changeJournalOpen}
        onClose={() => setChangeJournalOpen(false)}
        searchStore={searchStore}
      />
    </>
  );
}
