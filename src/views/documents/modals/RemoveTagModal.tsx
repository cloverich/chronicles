import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import { Button } from "../../../components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/Dialog";
import { useBulkOperationsStore } from "../../../hooks/useBulkOperations";
import { useTags } from "../../../hooks/useTags";
import { SearchStore } from "../SearchStore";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  searchStore: SearchStore;
}

/**
 * Modal for removing a tag from search results
 */
export const RemoveTagModal = observer(
  ({ open, onClose, searchStore }: ModalProps) => {
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const { tags } = useTags();
    const bulkOps = useBulkOperationsStore();

    const handleSubmit = () => {
      if (!selectedTag) return;

      // Fire and forget - store handles the async operation
      bulkOps.removeTag(
        {
          journals: searchStore.selectedJournals,
          tags: searchStore.selectedTags,
        },
        selectedTag,
      );

      handleClose();
    };

    const handleClose = () => {
      setSelectedTag(null);
      onClose();
    };

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Tag</DialogTitle>
            <DialogDescription>
              Remove a tag from all documents in the active search
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">
              Tag to remove
            </label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={selectedTag || ""}
              onChange={(e) => setSelectedTag(e.target.value || null)}
            >
              <option value="">Select a tag...</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedTag}>
              Remove Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
