import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import { Button } from "../../../components/Button";
import { Dialog } from "../../../components/Dialog";
import * as Select from "../../../components/Select";
import { useBulkOperationsStore } from "../../../hooks/useBulkOperations";
import { useJournals } from "../../../hooks/useJournals";
import { SearchStore } from "../SearchStore";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  searchStore: SearchStore;
}

/**
 * Modal for changing the journal of search results
 */
export const ChangeJournalModal = observer(
  ({ open, onClose, searchStore }: ModalProps) => {
    const [selectedJournal, setSelectedJournal] = useState<string | null>(null);
    const journalsStore = useJournals();
    const bulkOps = useBulkOperationsStore();

    const handleSubmit = () => {
      if (!selectedJournal) return;

      // Fire and forget - store handles the async operation
      bulkOps.changeJournal(
        {
          journals: searchStore.selectedJournals,
          tags: searchStore.selectedTags,
        },
        selectedJournal,
      );

      handleClose();
    };

    const handleClose = () => {
      setSelectedJournal(null);
      onClose();
    };

    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        title="Change Journal"
        description="Move all documents in the active search to a different journal"
        actions={
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedJournal}>
              Change Journal
            </Button>
          </>
        }
      >
        <div className="py-4">
          <label className="mb-2 block text-sm font-medium">
            Destination journal
          </label>
          <Select.Base
            value={selectedJournal || ""}
            onValueChange={(value) => setSelectedJournal(value || null)}
          >
            <Select.Trigger className="w-full">
              <Select.Value placeholder="Select a journal..." />
            </Select.Trigger>
            <Select.Content>
              {journalsStore.journals
                .filter((j) => !j.archived)
                .map((journal) => (
                  <Select.Item key={journal.name} value={journal.name}>
                    {journal.name}
                  </Select.Item>
                ))}
            </Select.Content>
          </Select.Base>
        </div>
      </Dialog>
    );
  },
);
