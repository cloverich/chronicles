import React from "react";
import { Root as VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { Pane, Card, Heading, IconButton, PlusIcon } from "evergreen-ui";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/Sidesheet";
import { SidebarProps } from "../Layout";
import "./sidebar-styles.css";
import { observer } from "mobx-react-lite";
import { useSidebarStore } from "./store";
import { SidebarStore } from "./store";
import { JournalCreateForm, JournalItem, Collapse } from "./JournalItem";
import { TagsList } from "./TagsList";

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
        side="left"
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
    <>
      {" "}
      <Card
        backgroundColor="white"
        elevation={0}
        padding={16}
        marginBottom={16}
      >
        <Pane>
          <Heading>
            Active Journals{" "}
            <IconButton
              icon={PlusIcon}
              size="small"
              onClick={store.toggleAdding}
              disabled={store.adding}
            >
              Add Journal
            </IconButton>
          </Heading>
        </Pane>
        <ul className="ml-0 text-sm">
          {store.adding && (
            <li>
              <JournalCreateForm done={store.toggleEditing} />
            </li>
          )}

          {store.journalStore.active.map((j) => {
            return (
              <li key={j.id}>
                <JournalItem
                  journal={j}
                  store={store}
                  editing={store.editing === j.id}
                  isArchived={store.journalStore.archived.includes(j)}
                  isDefault={j.id === store.journalStore.defaultJournalId}
                />
              </li>
            );
          })}
        </ul>

        <Collapse>
          <ul className="ml-0 text-sm">
            {store.journalStore.archived.map((j) => {
              return (
                <li key={j.id}>
                  <JournalItem
                    journal={j}
                    store={store}
                    editing={store.editing === j.id}
                    isArchived={store.journalStore.archived.includes(j)}
                    isDefault={j.id === store.journalStore.defaultJournalId}
                  />
                </li>
              );
            })}
          </ul>
        </Collapse>
      </Card>
      <TagsList search={store.searchTag} />
    </>
  );
});
