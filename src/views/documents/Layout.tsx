import React from "react";
import { Pane, IconButton, FolderOpenIcon } from "evergreen-ui";
import SearchDocuments from "./search";
import { Link } from "react-router-dom";
import { SearchStore } from "./SearchStore";
import { JournalSelectionSidebar } from "./Sidebar";

interface Props {
  store: SearchStore;
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
        <SearchDocuments store={props.store} />
      </Pane>
      <Pane>
        <Link to="/documents/edit/new">Create new</Link>
      </Pane>
      <Pane marginTop={24}>{props.children}</Pane>
    </Pane>
  );
}

export interface SidebarProps {
  isShown: boolean;
  setIsShown: (isShown: boolean) => void;
  search: SearchStore;
}
