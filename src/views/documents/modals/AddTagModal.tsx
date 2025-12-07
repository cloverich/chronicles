import { observer } from "mobx-react-lite";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/Dialog";
import TagInput from "../../../components/tag-input/TagInput";
import { useBulkOperationsStore } from "../../../hooks/useBulkOperations";
import { useTags } from "../../../hooks/useTags";
import { SearchStore } from "../SearchStore";
import { TagTokenParser } from "../search/parsers/tag";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  searchStore: SearchStore;
}

/**
 * Modal for adding a tag to search results
 */
export const AddTagModal = observer(
  ({ open, onClose, searchStore }: ModalProps) => {
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const { tags: allTagsRaw } = useTags();
    const bulkOps = useBulkOperationsStore();

    const allTags = useMemo(() => {
      return allTagsRaw.map((t) => ({ value: t }));
    }, [allTagsRaw]);

    const handleAddTag = (tag: string) => {
      // Parse/validate to match FrontMatter behavior
      const parsed = new TagTokenParser().parse(tag)?.value;
      if (!parsed) {
        toast.error("Invalid tag format");
        return;
      }
      setSelectedTag(parsed);
    };

    const handleRemoveTag = () => {
      setSelectedTag(null);
    };

    const handleSubmit = () => {
      if (!selectedTag) return;

      // Fire and forget - store handles the async operation
      bulkOps.addTag(
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

    const tokens = selectedTag ? [selectedTag] : [];

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Add a tag to all documents in the active search
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Tag to add</label>
            <TagInput
              tokens={tokens}
              onAdd={handleAddTag}
              onRemove={handleRemoveTag}
              placeholder="Type or select a tag"
              suggestions={allTags}
              openOnEmptyFocus={true}
              prefixHash={true}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedTag}>
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
