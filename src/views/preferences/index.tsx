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
import { Select } from "../../components/Select";
import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { SourceType } from "../../preload/client/importer/SourceType";
import { Preferences } from "../../preload/client/preferences";
import {
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
} from "../../preload/client/types";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";

const Preferences = observer(() => {
  const jstore = useJournals();
  const [store, _] = React.useState(() =>
    observable({
      preferences: {} as Preferences,
      loading: true,
      sourceType: SourceType.Other,
    }),
  );

  const client = useClient();
  const navigate = useNavigate();

  async function selectNotesRoot() {
    store.loading = true;
    try {
      const result = await client.preferences.openDialogNotesDir();
      if (!result?.value) {
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

  async function importDirectory() {
    store.loading = true;
    try {
      const result = await client.preferences.openDialogImportDir();
      if (!result) {
        store.loading = false;
        return;
      }

      await client.importer.import(result, store.sourceType);
      store.loading = false;
    } catch (e) {
      console.error("Error importing directory", e);
      store.loading = false;
      toaster.danger("Failed to import directory");
    }
  }

  async function clearImportTable() {
    store.loading = true;
    try {
      await client.importer.clearImportTables();
      store.loading = false;
      toaster.success("Import table cleared");
    } catch (e) {
      console.error("Error clearing import table", e);
      store.loading = false;
      toaster.danger("Failed to clear import table");
    }
  }

  async function sync() {
    if (store.loading) return;

    toaster.notify("Syncing cache...may take a few minutes");
    store.loading = true;

    // force sync when called manually
    await client.sync.sync(true);
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
          <h4>Settings</h4>
          <p>Settings file: {client.preferences.settingsPath()}</p>
          <p>
            Database file: <code>{store.preferences.DATABASE_URL}</code>
          </p>
        </SettingsBox>
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
            onClick={selectNotesRoot}
          >
            Select new directory
          </Button>
        </SettingsBox>
        <SettingsBox>
          <h4>Import markdown directory</h4>
          <p>Import a directory of markdown files. Experimental.</p>
          <p>
            The following file / directory names will be skipped:&nbsp;
            {Array.from(SKIPPABLE_FILES).join(", ")}
          </p>
          <p>
            Other than _attachments, the following prefixes will cause a file or
            directory to be skipped: {Array.from(SKIPPABLE_PREFIXES).join(", ")}
          </p>

          <Select
            selected={store.sourceType}
            options={[SourceType.Notion, SourceType.Other]}
            onSelect={(selected) => (store.sourceType = selected)}
            label="Import type"
            description="Whether to use the Notion specific parser, which checks for ids in titles and pseudo-front matter in content"
          />

          {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={importDirectory}
          >
            Import directory
          </Button>

          <h3>Clear Import Tables</h3>
          <p>
            ADVANCED: Re-running import from same location will skip previously
            imported files. To fully re-run the import, you can clear the import
            tables by clicking below, but this will result in duplicate files
            unless the prior imported files are removed (manually, by you) from
            root directory. Note ids are generated and tracked in the import
            table prior to creating the files, so these can be used to
            (manually) link imported files to their location in Chronicles.
          </p>
          <Button
            intent="danger"
            onClick={clearImportTable}
            disabled={store.loading}
          >
            Clear import table
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
            {store.preferences.DATABASE_URL}
          </p>
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={sync}
          >
            Sync folder
          </Button>
        </SettingsBox>
        <SettingsBox>
          <h4>Run tests</h4>
          <p>
            Run some tests, mostly around the frontmatter parsing and importing.
            See output in console.
          </p>
          <Button
            isLoading={store.loading}
            disabled={store.loading}
            onClick={() => {
              console.log("Running tests");
              client.tests.runTests();
            }}
          >
            Run Tests
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
