import React from "react";
import { Pane, IconButton, FolderOpenIcon } from "evergreen-ui";
import SearchDocuments from "./search";
import { Link } from "react-router-dom";
import { SearchStore } from "./SearchStore";
import JournalSelectionSidebar from "./sidebar/Sidebar";
import { SheetTrigger } from "../../components/Sidesheet";

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
        <JournalSelectionSidebar
          isShown={isSidebarOpen}
          setIsShown={setIsSidebarOpen}
          search={props.store}
        >
          <SheetTrigger asChild>
            <IconButton icon={FolderOpenIcon} marginRight={8}>
              Select Journals
            </IconButton>
          </SheetTrigger>
        </JournalSelectionSidebar>
        <SearchDocuments store={props.store} />
      </Pane>
      <Pane>
        <Link to="/documents/edit/new">Create new</Link>
      </Pane>
      <Pane marginTop={24}>{props.children}</Pane>
    </Pane>
  );
}

export type SidebarProps = React.PropsWithChildren<{
  isShown: boolean;
  setIsShown: (isShown: boolean) => void;
  search: SearchStore;
}>;
