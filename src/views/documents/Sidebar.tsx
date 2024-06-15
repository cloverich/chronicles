import React, { useContext } from "react";
import {
  Pane,
  SideSheet,
  Card,
  Heading,
  UnorderedList,
  ListItem,
  FolderCloseIcon,
} from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalResponse } from "../../hooks/useClient";
import { useTags } from "../../hooks/useTags";
import { SidebarProps } from "./Layout";

/**
 * Sidebar for selecting journals or tags to search by.
 */
export function JournalSelectionSidebar(props: SidebarProps) {
  const { isShown, setIsShown } = props;
  const jstore = useContext(JournalsStoreContext);
  const searchStore = props.search;

  function search(journal: string) {
    searchStore.setSearch([`in:${journal}`]);
    setIsShown(false);
    return false;
  }

  function searchTag(tag: string) {
    searchStore.setSearch([`tag:${tag}`]);
    setIsShown(false);
    return false;
  }

  return (
    <React.Fragment>
      <SideSheet
        position="left"
        isShown={isShown}
        onCloseComplete={() => setIsShown(false)}
        preventBodyScrolling
        containerProps={{
          display: "flex",
          flex: "1",
          flexDirection: "column",
        }}
      >
        <Pane zIndex={1} flexShrink={0} elevation={0} backgroundColor="white">
          <Pane padding={16}>
            <Heading size={600}>Journals</Heading>
          </Pane>
        </Pane>
        <Pane flex="1" overflowY="scroll" background="tint1" padding={16}>
          <JournalsCard
            journals={jstore.active}
            title="Active Journals"
            search={search}
          />
          <JournalsCard
            journals={jstore.archived}
            title="Archived Journals"
            search={search}
          />
          <TagsCard search={searchTag} />
        </Pane>
      </SideSheet>
    </React.Fragment>
  );
}

function TagsCard(props: { search: (tag: string) => boolean }) {
  const { loading, error, tags } = useTags();

  if (loading) {
    return "loading...";
  }

  if (error) {
    console.error("error loading tags", error);
    return "error loading tags";
  }

  const tagItems = tags.map((t) => {
    return (
      <ListItem key={t} icon={FolderCloseIcon}>
        <a href="" onClick={() => props.search(t)}>
          {t}
        </a>
      </ListItem>
    );
  });

  return (
    <Card backgroundColor="white" elevation={0} padding={16} marginBottom={16}>
      <Heading>Tags</Heading>
      <UnorderedList>{tagItems}</UnorderedList>
    </Card>
  );
}

function JournalsCard(props: {
  journals: JournalResponse[];
  title: string;
  search: (journalName: string) => boolean;
}) {
  if (!props.journals.length) {
    return null;
  }

  const journals = props.journals.map((j) => {
    return (
      <ListItem key={j.id} icon={FolderCloseIcon}>
        <a href="" onClick={() => props.search(j.name)}>
          {j.name}
        </a>
      </ListItem>
    );
  });

  return (
    <Card backgroundColor="white" elevation={0} padding={16} marginBottom={16}>
      <Heading>{props.title}</Heading>
      <UnorderedList>{journals}</UnorderedList>
    </Card>
  );
}
