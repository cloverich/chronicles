import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { PropsWithChildren } from "react";
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
import { usePreferences } from "../../hooks/usePreferences";
import { SourceType } from "../../preload/client/importer/SourceType";
import {
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
} from "../../preload/client/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesPane = observer((props: Props) => {
  const jstore = useJournals();
  const client = useClient();
  const [store, _] = React.useState(() =>
    observable({
      loading: false,
      sourceType: SourceType.Other,
    }),
  );
  const preferences = usePreferences();

  async function selectNotesRoot() {
    store.loading = true;
    try {
      const result = await window.chronicles.openDialogSelectDir();
      if (!result.value) {
        store.loading = false;
        return;
      }

      preferences.notesDir = result.value;
      sync();
    } catch (e) {
      store.loading = false;
      toast.error("Failed to set new directory");
    }
  }

  async function importDirectory() {
    store.loading = true;
    try {
      const result = await window.chronicles.openDialogSelectDir();
      if (!result?.value) {
        store.loading = false;
        return;
      }

      await client.importer.import(result.value, store.sourceType);
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
                  title="Appearance"
                  sub="Customize the look and feel of Chronicles"
                />

                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <dt className="text-foreground-strong font-medium">Theme</dt>
                  <dd className="mb-2 text-xs text-muted-foreground">
                    <code>Default</code>
                  </dd>
                  <dt className="text-foreground-strong font-medium">
                    <Label.Base htmlFor=":r2g:-form-item">
                      Appearance
                    </Label.Base>
                  </dt>
                  <dd className="mb-2 text-xs text-muted-foreground">
                    <Select.Base
                      value={preferences.darkMode}
                      onValueChange={(selected) =>
                        (preferences.darkMode = selected as
                          | "light"
                          | "dark"
                          | "system")
                      }
                    >
                      <Select.Trigger className="max-w-[150px]">
                        <Select.Value placeholder="Light / Dark" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="light">Light</Select.Item>
                        <Select.Item value="dark">Dark</Select.Item>
                        <Select.Item value="system">System</Select.Item>
                      </Select.Content>
                    </Select.Base>
                  </dd>
                </dl>
              </Section>
              <Section>
                <SectionTitle
                  title="Fonts"
                  sub="Customize fonts for different parts of the application"
                />

                <div className="space-y-6">
                  <div>
                    <h4 className="mb-3 text-base font-medium">Base Fonts</h4>
                    <div className="space-y-4">
                      <FontSelector
                        label="Heading"
                        description="Hubot Sans (bundled) - Main headings and titles"
                        value={
                          preferences.fonts?.heading || "Hubot Sans (bundled)"
                        }
                        onChange={(font) => {
                          preferences.fonts.heading = font;
                        }}
                      />
                      <FontSelector
                        label="Body"
                        description="Mona Sans (bundled) - Interface and content text"
                        value={preferences.fonts?.body || "Mona Sans (bundled)"}
                        onChange={(font) => {
                          preferences.fonts.body = font;
                        }}
                      />
                      <FontSelector
                        label="Mono"
                        description="IBM Plex Mono (bundled) - Code blocks and dates"
                        value={
                          preferences.fonts?.mono || "IBM Plex Mono (bundled)"
                        }
                        onChange={(font) => {
                          preferences.fonts.mono = font;
                        }}
                      />
                      <FontSelector
                        label="System Body"
                        description="Mona Sans (bundled) - Interface elements, sidebar, preferences"
                        value={
                          preferences.fonts?.systemBody || "Mona Sans (bundled)"
                        }
                        onChange={(font) => {
                          preferences.fonts.systemBody = font;
                        }}
                      />
                      <FontSelector
                        label="System Heading"
                        description="Hubot Sans (bundled) - Interface section titles and headers"
                        value={
                          preferences.fonts?.systemHeading ||
                          "Hubot Sans (bundled)"
                        }
                        onChange={(font) => {
                          preferences.fonts.systemHeading = font;
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 text-base font-medium">
                      Specific Elements
                    </h4>
                    <div className="space-y-4">
                      <FontSelector
                        label="Heading 2"
                        description="Defaults to: Heading"
                        value={
                          preferences.fonts?.heading2 || "Default (Heading)"
                        }
                        onChange={(font) => {
                          preferences.fonts.heading2 =
                            font === "Default (Heading)" ? undefined : font;
                        }}
                        isSpecific={true}
                      />
                      <FontSelector
                        label="Heading 3"
                        description="Defaults to: Heading"
                        value={
                          preferences.fonts?.heading3 || "Default (Heading)"
                        }
                        onChange={(font) => {
                          preferences.fonts.heading3 =
                            font === "Default (Heading)" ? undefined : font;
                        }}
                        isSpecific={true}
                      />
                    </div>
                  </div>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Configuration files"
                  sub="Configuration and database files, and base notes directory"
                />
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <dt className="text-foreground-strong font-medium">
                    Settings file
                  </dt>
                  <dd className="mb-2 text-xs text-muted-foreground">
                    <code>{client.preferences.settingsPath()}</code>
                  </dd>

                  <dt className="text-foreground-strong font-medium">
                    Database file
                  </dt>
                  <dd className="mb-2 text-xs text-muted-foreground">
                    <code>{preferences.databaseUrl}</code>
                  </dd>

                  <dt className="text-foreground-strong font-medium">
                    Notes directory
                  </dt>
                  <dd className="mb-2 text-xs text-muted-foreground">
                    <code>{preferences.notesDir}</code>
                  </dd>
                </dl>
                {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectNotesRoot}
                    disabled={store.loading}
                    loading={store.loading}
                  >
                    Change directory
                  </Button>
                </div>
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
                <div className="mt-4 flex justify-end">
                  {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
                  <Button
                    variant="ghost"
                    loading={store.loading}
                    disabled={store.loading}
                    onClick={importDirectory}
                    size="sm"
                  >
                    Import directory
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Clear import table"
                  sub="Clearing import tables and syncing cache"
                />
                <p className="mb-2">
                  <strong>(Advanced)</strong> Re-running import from same
                  location will skip previously imported files. To fully re-run
                  the import, you can clear the import tables by clicking below,
                  but this will result in duplicate files unless the prior
                  imported files are removed (<strong>manually, by you</strong>)
                  from root directory.
                </p>
                <p className="mb-2">
                  Note that ids are generated and tracked in the import table
                  prior to creating the files, so these can be used to
                  (manually) link imported files to their location in
                  Chronicles.
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={clearImportTable}
                    disabled={store.loading}
                  >
                    Clear import table
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Sync (Rebuild cache)"
                  sub="Rebuild the cache from the filesystem"
                />
                <p className="mb-2">
                  Chronicles builds an index of all documents and journals
                  (folders) in <code>notesDir</code> to power its search and
                  general operation. When the cache is out of sync with the
                  filesystem, this can cause issues such as missing documents,
                  tags, or journals.
                </p>
                <p className="mb-2">
                  "Syncing" the cache will rebuild the index from the
                  filesystem, ensuring that all documents, journals, and tags
                  are correctly indexed. This should be done anytime you make
                  changes to the filesystem outside of the app, including from
                  another device (if the <code>notesDir</code> is synced via a
                  cloud service).
                </p>
                <p className="mb-2">
                  The current Chronicles cache is located at{" "}
                  <code>{preferences.databaseUrl}</code>
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    loading={store.loading}
                    disabled={store.loading}
                    onClick={sync}
                  >
                    Sync folder
                  </Button>
                </div>
              </Section>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
});

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
    <div className="mb-10 mt-4 border-b border-gray-200 pb-8 dark:border-gray-700">
      {props.children}
    </div>
  );
}

const BASE_FONT_OPTIONS = [
  "sans-serif",
  "serif",
  "monospace",
  "Hubot Sans (bundled)",
  "Mona Sans (bundled)",
  "IBM Plex Mono (bundled)",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Times New Roman, serif",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Tahoma, sans-serif",
  "Trebuchet MS, sans-serif",
  "Impact, sans-serif",
  "Palatino, serif",
  "Garamond, serif",
  "Monaco, monospace",
  "Consolas, monospace",
  "Courier New, monospace",
  "Lucida Console, monospace",
  "SF Mono, monospace",
  "Menlo, monospace",
  "Fira Code, monospace",
  "Source Code Pro, monospace",
];

const SPECIFIC_FONT_OPTIONS = ["Default (Heading)", ...BASE_FONT_OPTIONS];

// Map display names to actual font stacks
const FONT_STACK_MAP: Record<string, string> = {
  "sans-serif":
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  monospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
  "Hubot Sans (bundled)":
    '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  "Mona Sans (bundled)":
    '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  "IBM Plex Mono (bundled)":
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
};

function FontSelector({
  label,
  description,
  value,
  onChange,
  isSpecific = false,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (font: string) => void;
  isSpecific?: boolean;
}) {
  const options = isSpecific ? SPECIFIC_FONT_OPTIONS : BASE_FONT_OPTIONS;

  // Convert actual font stack back to display name for the UI
  const displayValue =
    Object.entries(FONT_STACK_MAP).find(([_, stack]) => stack === value)?.[0] ||
    value;

  const handleChange = (selectedDisplayName: string) => {
    // Convert display name to actual font stack
    const actualFontStack =
      FONT_STACK_MAP[selectedDisplayName] || selectedDisplayName;
    onChange(actualFontStack);
  };

  return (
    <div>
      <div className="mb-2">
        <Label.Base className="text-sm font-medium">{label}</Label.Base>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Select.Base value={displayValue} onValueChange={handleChange}>
        <Select.Trigger className="max-w-[250px]">
          <Select.Value />
        </Select.Trigger>
        <Select.Content className="max-h-[300px]">
          {options.map((font) => (
            <Select.Item
              key={font}
              value={font}
              style={{
                fontFamily: font.startsWith("Default")
                  ? "inherit"
                  : FONT_STACK_MAP[font] || font,
              }}
            >
              {font}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Base>
    </div>
  );
}

export default PreferencesPane;
