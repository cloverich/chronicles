import React from "react";
import {
  Pane,
  IconButton,
  FolderOpenIcon,
  EditIcon,
  PanelStatsIcon,
} from "evergreen-ui";
import SearchDocuments from "./search";
import { Link, useNavigate } from "react-router-dom";
import { SearchStore } from "./SearchStore";
import JournalSelectionSidebar from "./sidebar/Sidebar";
import { SheetTrigger } from "../../components/Sidesheet";
import Titlebar from "../../titlebar/macos";

interface Props {
  store: SearchStore;
  children: any;
  empty?: boolean;
}

export function Layout(props: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Titlebar className="pr-16">
        <JournalSelectionSidebar
          isShown={isSidebarOpen}
          setIsShown={setIsSidebarOpen}
          search={props.store}
        >
          <SheetTrigger asChild>
            <IconButton
              backgroundColor="transparent"
              border="none"
              icon={PanelStatsIcon}
              marginRight={8}
              className="drag-none"
            >
              Select Journals
            </IconButton>
          </SheetTrigger>
        </JournalSelectionSidebar>

        <IconButton
          backgroundColor="transparent"
          border="none"
          icon={EditIcon}
          className="drag-none"
          onClick={() => navigate("/documents/edit/new")}
          marginRight={8}
        >
          Create new note
        </IconButton>

        <SearchDocuments store={props.store} />
      </Titlebar>

      <Pane padding={50} flexGrow={1} display="flex">
        <Pane>
          <Pane></Pane>
          <Pane marginTop={24}>{props.children}</Pane>
        </Pane>
      </Pane>
    </>
  );
}
