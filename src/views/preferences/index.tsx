import {
  Button,
  ChevronLeftIcon,
  IconButton,
  Pane,
  toaster,
} from "evergreen-ui";
import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { PropsWithChildren, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { Preferences } from "../../preload/client/preferences";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";

const Preferences = observer(() => {
  const jstore = useJournals();
  const [store, _] = React.useState(() =>
    observable({
      preferences: {} as Preferences,
      loading: true,
    }),
  );

  const client = useClient();
  const navigate = useNavigate();

  async function openDialogNotesDir() {
    store.loading = true;
    try {
      const result = await client.preferences.openDialogNotesDir();
      if (!result.value) {
        store.loading = false;
        return;
      }

      store.preferences = await client.preferences.all();
      store.loading = false;
      sync();
    } catch (e) {
      store.loading = false;
      toaster.danger("Failed to set new directory");
    }
  }

  async function sync() {
    if (store.loading) return;

    toaster.notify("Syncing cache...may take a few minutes");
    store.loading = true;
    await client.imports.sync();
    await jstore.refresh();
    store.loading = false;
    toaster.success("Cache synced");
  }

  useEffect(() => {
    async function load() {
      store.preferences = await client.preferences.all();
      store.loading = false;
    }

    load();

    return () => {
      // todo: Re-implement a single general listener for preferences-updated,
      // test that the prefernces store can correctly call a cb when preferences are updated
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
          <h4>Settings directory</h4>
          <p>
            Location of files / directories are persisted to the settings file
            located at {client.preferences.settingsPath()}
          </p>
        </SettingsBox>
        {/* <SettingsBox>
          <h4>Export</h4>
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={() =>
              client.export.export(
                "/Users/cloverich/Documents/chronicles-development/export",
              )
            }
          >
            Export database to
            "/Users/cloverich/Documents/chronicles-development/export"
          </Button>
        </SettingsBox> */}

        <SettingsBox>
          <h4>Chronicles Notes Root</h4>
          <p>
            Base directory against which documents and attachments are created /
            read from
          </p>
          <p>This directory is currently located at:</p>
          <p>
            <code>{store.preferences.NOTES_DIR}</code>
          </p>

          {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={openDialogNotesDir}
          >
            Select new directory
          </Button>
        </SettingsBox>
        <SettingsBox>
          <h4>Re-build cache (Sync)</h4>
          <p>
            Chronicles builds an index of all documents and journals (folders)
            in NOTES_DIR to power its search and general operation. When the
            cache is out of sync with the filesystem, this can cause issues such
            as missing documents, tags, or journals.
          </p>
          <p>
            "Syncing" the cache will rebuild the index from the filesystem,
            ensuring that all documents, journals, and tags are correctly
            indexed. This should be done anytime you make changes to the
            filesystem outside of the app, including from another device (if the
            NOTES_DIR is synced via a cloud service).
          </p>
          <p>
            The current Chronicles cache is located at{" "}
            {store.preferences.CACHE_DIR}
          </p>
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={sync}
          >
            Sync folder
          </Button>
        </SettingsBox>
        <Base.BottomSpacer />
      </Base.ScrollContainer>
    </Base.Container>
  );
});

export default Preferences;

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
