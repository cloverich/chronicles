import {
  EditIcon,
  IconButton,
  PanelStatsIcon,
  SettingsIcon,
} from "evergreen-ui";
import React from "react";
import { useNavigate } from "react-router-dom";
import { SheetTrigger } from "../../components/Sidesheet";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";
import { SearchStore } from "./SearchStore";
import SearchDocuments from "./search";
import JournalSelectionSidebar from "./sidebar/Sidebar";

interface Props {
  store: SearchStore;
  children: any;
  empty?: boolean;
}

export function Layout(props: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <Base.Container>
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
        <IconButton
          backgroundColor="transparent"
          border="none"
          icon={SettingsIcon}
          className="drag-none"
          onClick={() => navigate("/preferences")}
          marginLeft={8}
        >
          Preferences
        </IconButton>
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>{props.children}</Base.ScrollContainer>
    </Base.Container>
  );
}
