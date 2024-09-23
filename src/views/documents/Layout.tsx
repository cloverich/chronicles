import {
  EditIcon,
  IconButton,
  PanelStatsIcon,
  SettingsIcon,
} from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import { useNavigate } from "react-router-dom";
import { SheetTrigger } from "../../components/Sidesheet";
import { useJournals } from "../../hooks/useJournals";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";
import { SearchStore } from "./SearchStore";
import { SearchInput } from "./search";
import JournalSelectionSidebar from "./sidebar/Sidebar";

interface Props {
  store: SearchStore;
  children: any;
  empty?: boolean;
}

export const Layout = observer((props: Props) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const jstore = useJournals();

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
          disabled={jstore.journals.length === 0}
          onClick={() => navigate("/documents/edit/new")}
          marginRight={8}
        >
          Create new note
        </IconButton>

        <SearchInput />

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
});
