import * as ContextMenu from "@radix-ui/react-context-menu";
import { cn } from "@udecode/cn";
import { noop } from "lodash";
import { observer } from "mobx-react-lite";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { Icons } from "../../../components/icons";
import { JournalResponse } from "../../../hooks/useClient";
import { useIsMounted } from "../../../hooks/useIsMounted";
import { useJournals } from "../../../hooks/useJournals";
import { SidebarStore } from "./store";

export function JournalCreateForm({ done }: { done: () => any }) {
  const [journal, _] = React.useState<{ name: string }>({
    name: "My new journal",
  });

  return (
    <div className="flex">
      <Icons.folder size={19} className="mr-1" />
      <JournalEditor isNew journal={journal!} done={done} />
    </div>
  );
}

const menuItemCss = cn(
  "relative flex h-6 cursor-pointer select-none items-center pr-1 pl-6 text-xs outline-none transition-colors",
  "data-[disabled]:text-muted-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
  "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
);

/**
 * Displays a journal by name in the sidebar, with context menu actions
 * for editing, archiving, deleting, and setting as default.
 */
export const JournalItem = observer(
  ({
    journal,
    store,
    editing,
    isArchived,
    isDefault,
  }: {
    journal: JournalResponse;
    store: SidebarStore;
    editing: boolean;
    isArchived: boolean;
    isDefault: boolean;
  }) => {
    const onArchive = isDefault ? noop : () => store.onArchive(journal);
    const onDelete = isDefault ? noop : () => store.onDelete(journal);
    const onSetDefault = isDefault ? noop : () => store.onSetDefault(journal);

    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div className="flex items-center">
            <Icons.folder size={19} className="mr-1" />
            {editing ? (
              <JournalEditor journal={journal} done={store.toggleEditing} />
            ) : (
              <a href="" onClick={() => store.search(journal.name)}>
                {journal.name}
                {isDefault ? "*" : ""}
              </a>
            )}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            className="z-50 min-w-56 overflow-y-auto overflow-x-hidden border bg-popover p-1 text-popover-foreground shadow-md"
            alignOffset={5}
          >
            <ContextMenu.Label className="py-1 pl-6 text-xs text-accent-foreground">
              Journal management
            </ContextMenu.Label>

            <ContextMenu.Item
              className={menuItemCss}
              onClick={onArchive}
              disabled={isDefault}
            >
              {isArchived ? "Restore" : "Archive"}
            </ContextMenu.Item>

            <ContextMenu.Item
              className={menuItemCss}
              onClick={() => store.toggleEditing(journal.name)}
              disabled={isArchived}
            >
              Rename
            </ContextMenu.Item>

            <ContextMenu.CheckboxItem
              className={menuItemCss}
              checked={isDefault}
              onCheckedChange={() => {}}
              onClick={onSetDefault}
              disabled={isArchived}
            >
              <ContextMenu.ItemIndicator className="absolute left-0 inline-flex w-6 items-center justify-center">
                <Icons.check size="14" />
              </ContextMenu.ItemIndicator>
              Default
            </ContextMenu.CheckboxItem>

            <ContextMenu.Separator className="m-1 h-[1px] bg-accent" />

            <ContextMenu.Item
              className={menuItemCss}
              onClick={onDelete}
              disabled={isDefault}
            >
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    );
  },
);

/**
 * Editor for journal names. Used in the sidebar for renaming journals.
 */
const JournalEditor = observer(function JournalEditor({
  journal,
  done,
  isNew,
}: {
  isNew?: boolean;
  // New journal (no id) or existing journal (has id)
  journal: JournalResponse | { name: string };
  done: () => void;
}) {
  const [name, setName] = React.useState(journal.name);
  const [saving, setSaving] = React.useState(false);
  const store = useJournals();
  const isMounted = useIsMounted();

  const onSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (isNew) {
        await store.create(name);
      } else {
        await store.updateName(journal as JournalResponse, name);
      }

      if (isMounted()) {
        done();
      }
    } catch (err) {
      console.error(err);
      if (isMounted()) {
        toast.error(`Error saving journal: ${String(err)}`);
      }
    } finally {
      if (isMounted()) {
        setSaving(false);
      }
    }
  };

  const ref = useHotkeys<HTMLInputElement>(
    ["enter", "escape"],
    (e, handler) => {
      if (handler.keys?.includes("enter")) {
        onSave();
      } else if (handler.keys?.includes("escape")) {
        done();
      }
    },
    { enableOnFormTags: true },
    [onSave, done],
  );

  return (
    <>
      <input
        type="text"
        autoFocus
        className="border border-input bg-transparent px-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        ref={ref}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </>
  );
});

/*
 "RightSlot" css - this is the last CSS I did not migrate, when I replaced
 the previously imported .css file with tailwind classes. Leaving in case its
 needed:

.RightSlot {
  margin-left: auto;
  padding-left: 20px;
  color: var(--mauve-11);
}

[data-highlighted] > .RightSlot {
  color: white;
}

[data-disabled] .RightSlot {
  color: var(--mauve-8);
}


 */
