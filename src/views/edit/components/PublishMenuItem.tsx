import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../../components/DropdownMenu";
import {
  useMaintenance,
  type PublishAvailability,
} from "../../../hooks/useMaintenance";
import type { EditableDocument } from "../EditableDocument";

const LABELS: Record<PublishAvailability["state"], string> = {
  unavailable: "Publish to blog",
  draft: "Publish to blog",
  edited: "Publish changes",
  published: "Published",
};

/**
 * Writes the note's post folder into the blog folder (spec/publish.md).
 * Always shown; disabled with the reason when the blog isn't set up or the
 * note is outside the blog journal. Going live is the blog repo's own step
 * (its publish script).
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
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<PublishAvailability | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    maintenance
      .publishStatus({ id: document.id })
      .then((s) => live && setStatus(s))
      .catch(
        (err) =>
          live &&
          setStatus({
            state: "unavailable",
            reason: err instanceof Error ? err.message : String(err),
          }),
      );
    return () => {
      live = false;
    };
  }, [open, document.id]);

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

  const state = status?.state ?? "unavailable";
  const hint =
    status?.state === "unavailable"
      ? status.reason
      : status && "path" in status && status.path
        ? status.path
        : null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={publish}
        disabled={state === "unavailable" || state === "published"}
        className="flex-col items-start gap-0"
      >
        <span>{LABELS[state]}</span>
        {hint && (
          <span className="text-muted-foreground max-w-[240px] text-xs">
            {hint}
          </span>
        )}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate("/blog")}>
        Blog posts…
      </DropdownMenuItem>
    </>
  );
}
