import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { PropsWithChildren, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Label, Select } from "../../components";
import { Button } from "../../components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/Dialog";
import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { SourceType } from "../../preload/client/importer/SourceType";
import { Preferences } from "../../preload/client/preferences";
import {
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
} from "../../preload/client/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function Separator() {
  return <hr className="my-8 h-px border-0 bg-gray-200 dark:bg-gray-700" />;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0 text-lg font-medium">{title}</h3>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section(props: PropsWithChildren<any>) {
  return (
    <div className="mb-10 mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
      {props.children}
    </div>
  );
}

const Preferences = observer((props: Props) => {
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
      toast.error("Failed to set new directory");
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
      toast.error("Failed to import directory");
    }
  }

  async function clearImportTable() {
    store.loading = true;
    try {
      await client.importer.clearImportTables();
      store.loading = false;
      toast.success("Import table cleared");
    } catch (e) {
      console.error("Error clearing import table", e);
      store.loading = false;
      toast.error("Failed to clear import table");
    }
  }

  async function sync() {
    if (store.loading) return;

    toast.info("Syncing cache...may take a few minutes");
    store.loading = true;

    // force sync when called manually
    await client.sync.sync(true);
    await jstore.refresh();
    store.loading = false;
    toast.success("Cache synced");
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
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <Separator />
          <DialogDescription asChild>
            <div>
              <Section>
                <SectionTitle
                  title="General"
                  sub="Configuration and database files, and base notes directory"
                />
                <dl>
                  <dt>Settings file</dt>
                  <dd className="text-xs">
                    {client.preferences.settingsPath()}
                  </dd>

                  <dt>Database file</dt>
                  <dd className="text-xs">
                    <code>{store.preferences.DATABASE_URL}</code>
                  </dd>
                  <dt>Notes directory</dt>
                  <dd className="text-xs">
                    <code>{store.preferences.NOTES_DIR}</code>
                  </dd>
                </dl>
                {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
                <Button
                  loading={store.loading}
                  disabled={store.loading}
                  onClick={selectNotesRoot}
                  size="sm"
                >
                  Select new directory
                </Button>
              </Section>
              <Section>
                <SectionTitle
                  title="Import directory"
                  sub="Import a directory of markdown files. Experimental."
                />

                <details className="my-4">
                  <summary className="cursor-pointer outline-none">
                    Ignored files and directories
                  </summary>
                  <p className="p-2">
                    The following file / directory names will be skipped:&nbsp;
                    <code>{Array.from(SKIPPABLE_FILES).join(", ")}</code>
                  </p>
                  <p className="px-2">
                    Other than _attachments, the following prefixes will cause a
                    file or directory to be skipped:{" "}
                    <code>{Array.from(SKIPPABLE_PREFIXES).join(", ")}</code>
                  </p>
                </details>

                <div className="my-6 flex flex-col space-y-2">
                  <Label.Base
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor=":r2g:-form-item"
                  >
                    Import Type
                  </Label.Base>
                  <p
                    id=":r2g:-form-item-description"
                    className="text-[0.8rem] text-muted-foreground"
                  >
                    Whether to use the Notion specific parser, which checks for
                    ids in titles and pseudo-front matter in content.
                  </p>{" "}
                  <Select.Base
                    value={store.sourceType}
                    onValueChange={(selected) =>
                      (store.sourceType = selected as SourceType)
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Choose import type" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={SourceType.Notion}>
                        Notion
                      </Select.Item>
                      <Select.Item value={SourceType.Other}>Other</Select.Item>
                    </Select.Content>
                  </Select.Base>
                </div>

                {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
                <Button
                  loading={store.loading}
                  disabled={store.loading}
                  onClick={importDirectory}
                  size="sm"
                >
                  Import directory
                </Button>
              </Section>
              <Section>
                <SectionTitle
                  title="Clear import table"
                  sub="Clearing import tables and syncing cache"
                />
                <p className="mb-2">
                  ADVANCED: Re-running import from same location will skip
                  previously imported files. To fully re-run the import, you can
                  clear the import tables by clicking below, but this will
                  result in duplicate files unless the prior imported files are
                  removed (manually, by you) from root directory. Note ids are
                  generated and tracked in the import table prior to creating
                  the files, so these can be used to (manually) link imported
                  files to their location in Chronicles.
                </p>
                <Button
                  variant="destructive"
                  className="py-4"
                  size="sm"
                  onClick={clearImportTable}
                  disabled={store.loading}
                >
                  Clear import table
                </Button>
              </Section>
              <Section>
                <SectionTitle
                  title="Sync (Rebuild cache)"
                  sub="Rebuild the cache from the filesystem"
                />
                <p>
                  Chronicles builds an index of all documents and journals
                  (folders) in NOTES_DIR to power its search and general
                  operation. When the cache is out of sync with the filesystem,
                  this can cause issues such as missing documents, tags, or
                  journals.
                </p>
                <p>
                  "Syncing" the cache will rebuild the index from the
                  filesystem, ensuring that all documents, journals, and tags
                  are correctly indexed. This should be done anytime you make
                  changes to the filesystem outside of the app, including from
                  another device (if the NOTES_DIR is synced via a cloud
                  service).
                </p>
                <p>
                  The current Chronicles cache is located at{" "}
                  {store.preferences.DATABASE_URL}
                </p>
                <Button
                  loading={store.loading}
                  disabled={store.loading}
                  onClick={sync}
                  size="sm"
                >
                  Sync folder
                </Button>
              </Section>
              <Section>
                <SectionTitle title="Development" />
                <p>
                  Run some tests, mostly around the frontmatter parsing and
                  importing. See output in console.
                </p>
                <Button
                  loading={store.loading}
                  disabled={store.loading}
                  size="sm"
                  onClick={() => {
                    console.log("Running tests");
                    client.tests.runTests();
                  }}
                >
                  Run Tests
                </Button>
              </Section>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
});

export default Preferences;
