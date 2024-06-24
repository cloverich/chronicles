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
import { Icons } from "../../components/icons";

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
          <ActiveJournalsList journals={jstore.active} search={search} />
          <ArchivedJournalsList journals={jstore.archived} search={search} />
          <TagsList search={searchTag} />
        </Pane>
      </SideSheet>
    </React.Fragment>
  );
}

// Displays tags that can be searched by
function TagsList(props: { search: (tag: string) => boolean }) {
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

// Displays collapsible list of archived journals that can be searched by
function ArchivedJournalsList(props: {
  journals: JournalResponse[];
  search: (journalName: string) => boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

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

  const Icon = isOpen ? Icons.chevronDown : Icons.chevronRight;

  return (
    <Card backgroundColor="white" elevation={0} padding={16} marginBottom={16}>
      <Pane display="flex" onClick={() => setIsOpen(!isOpen)} cursor="pointer">
        <Heading>Archived Journals</Heading>
        <Icon size={18} />
      </Pane>
      {isOpen && <UnorderedList>{journals}</UnorderedList>}
    </Card>
  );
}

//  Active journals that can be searched by
function ActiveJournalsList(props: {
  journals: JournalResponse[];
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
      <Heading>Active Journals</Heading>
      <UnorderedList>{journals}</UnorderedList>
    </Card>
  );
}
