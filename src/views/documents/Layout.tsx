import { observer } from "mobx-react-lite";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";

import { IconButton } from "../../components/IconButton";
import { SheetTrigger } from "../../components/Sidesheet";
import { useApplicationState } from "../../hooks/useApplicationLoader";
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
  // todo: move journals sidebar open to application state...
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const appState = useApplicationState();
  const navigate = useNavigate();
  const jstore = useJournals();

  // Keyboard shortcut: mod+n to create new note
  useHotkeys(
    "mod+n",
    (e) => {
      if (jstore.journals.length > 0) {
        e.preventDefault();
        navigate("/documents/edit/new");
      }
    },
    { enableOnFormTags: true },
    [navigate, jstore.journals.length],
  );

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
              variant="ghost"
              className="mr-2 drag-none"
              icon="panel-right"
              aria-label="Select journals"
            />
          </SheetTrigger>
        </JournalSelectionSidebar>

        <IconButton
          variant="ghost"
          className="mr-2 drag-none"
          icon="editing"
          disabled={jstore.journals.length === 0}
          onClick={() => navigate("/documents/edit/new")}
          aria-label="Create new note"
        />

        <SearchInput />

        <IconButton
          variant="ghost"
          icon="settings"
          className="ml-2 drag-none"
          onClick={() => appState.togglePreferences(true)}
          aria-label="Open preferences"
        />
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>{props.children}</Base.ScrollContainer>
    </Base.Container>
  );
});
