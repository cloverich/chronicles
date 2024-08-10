import React, { useState, useEffect, PropsWithChildren } from "react";
import { Pane, Button, IconButton, ChevronLeftIcon } from "evergreen-ui";
import useClient from "../../hooks/useClient";
import { RouteProps, useNavigate } from "react-router-dom";
import * as Base from "../layout";
import Titlebar from "../../titlebar/macos";

interface Props extends RouteProps {
  // TODO: any added to satisfy ts check step; previously
  // this was ViewState which does not exist. Review and fix.
  setView?: React.Dispatch<React.SetStateAction<any>>;
}

export default function Preferences(props: Props) {
  const [preferences, setPreferences] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const client = useClient();
  const navigate = useNavigate();

  // todo: Ideally this could go into a preload script
  // see the main script (electron/index) for the other half
  function openDialog() {
    setLoading(true);
    // todo: lol this name
    client.preferences.openDialog();
    // ipcRenderer.send("select-database-file");

    // todo: replace  this hack with a timeout button, or implement
    // a listener for the results (overkill imho)
    setTimeout(() => setLoading(false), 1500);
  }

  function openDialogUserFiles() {
    setLoading(true);
    client.preferences.openDialogUserFiles();
    // ipcRenderer.send("select-user-files-dir");

    // todo: replace this hack with a timeout button, or implement
    // a listener for the results (overkill imho)
    setTimeout(() => setLoading(false), 1500);
  }

  useEffect(() => {
    async function load() {
      if (loading) return;
      setPreferences(await client.preferences.get());
      setLoading(false);
    }

    // reload anytime preferences update
    // ipcRenderer.on("preferences-updated", load);
    load();

    return () => {
      // ipcRenderer.removeListener("preferences-updated", load);
    };
  }, []);

  return (
    <Base.Container>
      <Titlebar>
        <IconButton
          backgroundColor="transparent"
          border="none"
          icon={ChevronLeftIcon}
          className="drag-none"
          onClick={() => navigate(-1)}
          marginRight={8}
        >
          Back to prior page
        </IconButton>
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>
        <SettingsBox>
          <h4>Database</h4>
          <p>Chronicles documents are stored in a SQLite database file.</p>
          <p>This file is located at: </p>
          <p>
            <code>{preferences.DATABASE_URL}</code>
          </p>
          <ul>
            <li>
              <b>To create a backup:</b> Make a copy of the database file
            </li>
            <li>
              <b>To restore from a backup:</b> Use the filepicker below to point
              the app at your backed up file
            </li>
            <li>
              <b>To change the files location:</b> <i>First</i> move the
              existing database file to your desired location, <i>then</i> use
              the filepicker to select the new location
            </li>
            &nbsp;then restart the app
          </ul>

          {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
          <Button isLoading={loading} disabled={loading} onClick={openDialog}>
            Select new file
          </Button>
        </SettingsBox>
        <SettingsBox>
          <h4>User Files Directory</h4>
          <p>
            Chronicles images and other user files are stored in the
            `USER_FILES` directory
          </p>
          <p>This file is located at:</p>
          <p>
            <code>{preferences.USER_FILES_DIR}</code>
          </p>
          <p>
            To change the directory location, <b>first</b> move the existing
            directory to the desired location, and then select the new location
            with the button below
          </p>

          {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
          <Button
            isLoading={loading}
            disabled={loading}
            onClick={openDialogUserFiles}
          >
            Select new directory
          </Button>
        </SettingsBox>

        <Base.BottomSpacer />
      </Base.ScrollContainer>
    </Base.Container>
  );
}

function SettingsBox(props: PropsWithChildren<any>) {
  return (
    <Pane
      border="muted"
      background="tint2"
      paddingX={36}
      paddingY={24}
      marginY={24}
    >
      {props.children}
    </Pane>
  );
}
