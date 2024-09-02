import * as ContextMenu from "@radix-ui/react-context-menu";
import { Heading, Pane, toaster } from "evergreen-ui";
import { noop } from "lodash";
import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Icons } from "../../../components/icons";
import { JournalResponse } from "../../../hooks/useClient";
import { useIsMounted } from "../../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../../hooks/useJournalsLoader";
import { SidebarStore } from "./store";

/**
 * Collapse component that can be toggled open and closed.
 */
export function Collapse(props: { defaultOpen?: boolean; children: any }) {
  const [isOpen, setIsOpen] = React.useState(
    props.defaultOpen == null ? false : props.defaultOpen,
  );

  const Icon = isOpen ? Icons.chevronDown : Icons.chevronRight;

  return (
    <Pane>
      <Pane display="flex" onClick={() => setIsOpen(!isOpen)} cursor="pointer">
        <Heading>Archived Journals</Heading>
        <Icon size={18} />
      </Pane>
      {isOpen && props.children}
    </Pane>
  );
}

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
    // api idea: const {archive, delete, setDefault} = actionGroup(store, 'archive', 'delete', 'setDefault');
    // Provides a loading state, error state, and success state, and ties them all together
    // todo: make computed value on journal itself
    // todo: make methods on Journal model itself
    const onArchive = isDefault ? noop : () => store.onArchive(journal);
    const onDelete = isDefault ? noop : () => store.onDelete(journal);
    const onSetDefault = isDefault ? noop : () => store.onSetDefault(journal);

    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger className="ContextMenuTrigger">
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
          <ContextMenu.Content className="ContextMenuContent" alignOffset={5}>
            <ContextMenu.Label className="ContextMenuLabel">
              Journal management
            </ContextMenu.Label>

            <ContextMenu.Item
              className="ContextMenuItem"
              onClick={onArchive}
              disabled={isDefault}
            >
              {isArchived ? "Restore" : "Archive"}
            </ContextMenu.Item>

            <ContextMenu.Item
              className="ContextMenuItem"
              onClick={() => store.toggleEditing(journal.id)}
              disabled={isArchived}
            >
              Rename
            </ContextMenu.Item>

            <ContextMenu.CheckboxItem
              className="ContextMenuCheckboxItem"
              checked={isDefault}
              onCheckedChange={() => {}}
              onClick={onSetDefault}
              disabled={isArchived}
            >
              <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
                <Icons.check />
              </ContextMenu.ItemIndicator>
              Default
            </ContextMenu.CheckboxItem>

            <ContextMenu.Separator className="ContextMenuSeparator" />

            <ContextMenu.Item
              className="ContextMenuItem"
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
}: {
  isNew?: boolean;
  // New journal (no id) or existing journal (has id)
  journal: { id: string; name: string } | { name: string };
  done: () => void;
}) {
  const [name, setName] = React.useState(journal.name);
  const [saving, setSaving] = React.useState(false);
  const store = useContext(JournalsStoreContext)!;
  const isMounted = useIsMounted();

  const onSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if ("id" in journal) {
        await store.updateName(journal.id, name);
      } else {
        await store.create({ name });
      }

      if (isMounted()) {
        done();
      }
    } catch (err) {
      const msg =
        "id" in journal
          ? `Error updating journal name for ${journal.id}`
          : "Error creating journal";
      console.error(msg, err);
      if (isMounted()) {
        toaster.danger(`Error saving journal: ${String(err)}`);
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
