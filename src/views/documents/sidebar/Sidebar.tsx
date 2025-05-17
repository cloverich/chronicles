import { Root as VisuallyHidden } from "@radix-ui/react-visually-hidden";
import React from "react";

import { observer } from "mobx-react-lite";
import { Collapse } from "../../../components/Collapse";
import { IconButton } from "../../../components/IconButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/Sidesheet";
import { SearchStore } from "../SearchStore";
import { JournalCreateForm, JournalItem } from "./JournalItem";
import { TagsList } from "./TagsList";
import { SidebarStore, useSidebarStore } from "./store";

type SidebarProps = React.PropsWithChildren<{
  isShown: boolean;
  setIsShown: (isShown: boolean) => void;
  search: SearchStore;
}>;

/**
 * Sidebar for selecting journals or tags to search by.
 */
export default observer(function JournalSelectionSidebar(props: SidebarProps) {
  const { isShown, setIsShown } = props;
  const store = useSidebarStore(props.search, setIsShown);

  return (
    <Sheet open={isShown} onOpenChange={store.onOpenChanged}>
      {props.children}
      <SheetContent
        side="right"
        className="overflow-auto"
        onEscapeKeyDown={(event) => {
          if (!store.shouldEscapeClose) {
            // Prevent sidesheet from closing, but bubble so edit actions can close
            event.preventDefault();
            store.toggleEditing();
          }
        }}
      >
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle>Journal / Tags</SheetTitle>
            <SheetDescription>
              Create and view journals, and search by tags.
            </SheetDescription>
          </SheetHeader>
        </VisuallyHidden>

        <InnerContent store={store} />
      </SheetContent>
    </Sheet>
  );
});

const InnerContent = observer(({ store }: { store: SidebarStore }) => {
  return (
    <div className="mt-6">
      <div className="mb-4 border p-4 shadow-md">
        <div>
          <div className="text-md mb-2 flex cursor-pointer items-center font-medium tracking-tight">
            Active Journals
            <IconButton
              icon="add"
              className="ml-1"
              onClick={store.toggleAdding}
              disabled={store.adding}
            >
              Add Journal
            </IconButton>
          </div>
        </div>
        <ul className="ml-0 text-sm">
          {store.adding && (
            <li>
              <JournalCreateForm done={store.toggleEditing} />
            </li>
          )}

          {store.journalStore.active.map((j) => {
            return (
              <li key={j.name}>
                <JournalItem
                  journal={j}
                  store={store}
                  editing={store.editing === j.name}
                  isArchived={store.journalStore.archived.includes(j)}
                  isDefault={j.name === store.journalStore.defaultJournal}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mb-4 p-4 shadow-md">
        <Collapse heading="Archived Journals">
          <ul className="ml-0 text-sm">
            {store.journalStore.archived.map((j) => {
              return (
                <li key={j.name}>
                  <JournalItem
                    journal={j}
                    store={store}
                    editing={store.editing === j.name}
                    isArchived={store.journalStore.archived.includes(j)}
                    isDefault={j.name === store.journalStore.defaultJournal}
                  />
                </li>
              );
            })}
          </ul>
        </Collapse>
      </div>
      <TagsList search={store.searchTag} />
    </div>
  );
});
