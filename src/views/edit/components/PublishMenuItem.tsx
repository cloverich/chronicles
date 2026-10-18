import * as React from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../../components/DropdownMenu";
import {
  useMaintenance,
  type PublishStatus,
} from "../../../hooks/useMaintenance";
import type { EditableDocument } from "../EditableDocument";

const LABELS: Record<PublishStatus["state"], string> = {
  draft: "Publish to blog",
  edited: "Publish changes",
  published: "Published",
};

/**
 * Writes the note's post folder into the blog folder (spec/publish.md).
 * Hidden unless a blog folder is set and the note is in the blog journal.
 * Going live is the blog repo's own step (its publish script).
 */
export function PublishMenuItem({
  document,
  open,
}: {
  document: EditableDocument;
  /** Re-read the state each time the menu opens. */
  open: boolean;
}) {
  const maintenance = useMaintenance();
  const [status, setStatus] = React.useState<PublishStatus | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    maintenance
      .publishStatus({ id: document.id })
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus(null));
    return () => {
      live = false;
    };
  }, [open, document.id]);

  if (!status) return null;

  async function publish() {
    try {
      await document.pinPublishPath();
      const result = await maintenance.publishNote({ id: document.id });
      setStatus(result);
      toast.success(
        `Wrote ${result.path}. Run the blog's publish script to put it live.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={publish}
        disabled={status.state === "published"}
      >
        {LABELS[status.state]}
      </DropdownMenuItem>
    </>
  );
}
