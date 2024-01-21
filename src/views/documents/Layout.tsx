import React, { useContext } from "react";
import {
  Pane,
  SideSheet,
  Card,
  Heading,
  UnorderedList,
  ListItem,
  FolderCloseIcon,
  IconButton,
  FolderOpenIcon,
} from "evergreen-ui";
import TagSearch from "./search";
import { Link } from "react-router-dom";
import { SearchV2Store } from "./SearchStore";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalResponse } from "../../hooks/useClient";

interface Props {
  store: SearchV2Store;
  children: any;
  empty?: boolean;
}

export function Layout(props: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <Pane>
      <Pane marginBottom={8}>
        <IconButton
          icon={FolderOpenIcon}
          onClick={() => setIsSidebarOpen(true)}
          marginRight={8}
        >
          Select Journals
        </IconButton>
        <JournalSelectionSidebar
          isShown={isSidebarOpen}
          setIsShown={setIsSidebarOpen}
          search={props.store}
        />
        <TagSearch store={props.store} />
      </Pane>
      <Pane>
        <Link to="/edit/new">Create new</Link>
      </Pane>
      <Pane marginTop={24}>{props.children}</Pane>
    </Pane>
  );
}

interface SidebarProps {
  isShown: boolean;
  setIsShown: (isShown: boolean) => void;
  search: SearchV2Store;
}

/**
 * Sidebar for selecting journals to search.
 */
function JournalSelectionSidebar(props: SidebarProps) {
  const { isShown, setIsShown } = props;
  const jstore = useContext(JournalsStoreContext);
  const searchStore = props.search;

  function search(journal: string) {
    searchStore.setSearch([`in:${journal}`]);
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
        </Pane>
      </SideSheet>
    </React.Fragment>
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
