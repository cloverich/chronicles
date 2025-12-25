import { observer } from "mobx-react-lite";
import React from "react";
import { Dialog } from "../../../components/Dialog";
import { BulkOperationType } from "../../../preload/client/bulk-operations";

/**
 * Modal for selecting which bulk operation to perform
 */
export const BulkOperationSelectorModal = observer(
  ({
    open,
    onClose,
    onSelectOperation,
  }: {
    open: boolean;
    onClose: () => void;
    onSelectOperation: (op: BulkOperationType) => void;
  }) => {
    const operations: {
      type: BulkOperationType;
      label: string;
      description: string;
    }[] = [
      {
        type: "add_tag",
        label: "Add Tag",
        description: "Add a tag to all matching documents",
      },
      {
        type: "remove_tag",
        label: "Remove Tag",
        description: "Remove a tag from all matching documents",
      },
      {
        type: "change_journal",
        label: "Change Journal",
        description: "Move all matching documents to a different journal",
      },
    ];

    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => !isOpen && onClose()}
        title="Bulk Operations"
        description="Select an operation to apply to the current search results"
      >
        <div className="flex flex-col gap-2">
          {operations.map((op) => (
            <button
              key={op.type}
              className="border-border hover:bg-accent hover:text-accent-foreground flex flex-col items-start rounded-md border p-3 text-left transition-colors"
              onClick={() => {
                onSelectOperation(op.type);
              }}
            >
              <span className="font-medium">{op.label}</span>
              <span className="text-muted-foreground text-sm">
                {op.description}
              </span>
            </button>
          ))}
        </div>
      </Dialog>
    );
  },
);
