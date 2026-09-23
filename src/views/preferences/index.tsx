import { FolderOpen, Trash2 } from "lucide-react";
import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Label } from "../../components";
import { Button } from "../../components/Button";
import {
  DialogRoot as Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/Dialog";
import { APPEARANCE_DEFAULTS } from "../../electron/appearance-defaults";
import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { useMaintenanceStore } from "../../hooks/useMaintenanceStore";
import { usePreferences } from "../../hooks/usePreferences";
import { SourceType } from "../../preload/client/importer/SourceType";
import {
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
} from "../../preload/client/types";
import { ThemeListEntry } from "../../themes/loader";
import { Input, InputProps } from "../documents/Input";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesPane = observer((props: Props) => {
  const navigate = useNavigate();
  const maintenanceStore = useMaintenanceStore();
  const journalsStore = useJournals();
  const client = useClient();
  const [store, _] = React.useState(() =>
    observable({
      loading: false,
      sourceType: SourceType.Other,
      replaceExisting: false,
    }),
  );
  const preferences = usePreferences();
  const [availableThemes, setAvailableThemes] = React.useState<
    ThemeListEntry[]
  >([]);
  const [availableFonts, setAvailableFonts] = React.useState<string[]>([]);
  const [settingsPath, setSettingsPath] = React.useState<string>("");
  // Code theme selection disabled until #176 is fixed
  // https://github.com/cloverich/chronicles/issues/176
  // const [hljsThemes, setHljsThemes] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (props.isOpen) {
      (async () => {
        const themesDir = `${preferences.settingsDir}/themes`;
        const { themes, overrides } =
          await window.chronicles.listAvailableThemes(themesDir);
        setAvailableThemes(themes);
        if (overrides.length > 0) {
          toast.info(
            `Your installed theme "${overrides.join('", "')}" overrides a bundled theme with the same name`,
          );
        }

        const fontsDir = `${preferences.settingsDir}/fonts`;
        const installedFonts =
          await window.chronicles.listInstalledFonts(fontsDir);
        setAvailableFonts(installedFonts);

        // Resolve async path for display
        try {
          const path = await client.preferences.settingsPath();
          setSettingsPath(path);
        } catch {
          setSettingsPath("(unknown)");
        }
        // setHljsThemes(await window.chronicles.listHljsThemes());
      })();
    }
  }, [props.isOpen, preferences.settingsDir]);

  async function selectNotesRoot() {
    store.loading = true;
    try {
      const result = await window.chronicles.openDialogSelectDir();
      if (!result.value) {
        store.loading = false;
        return;
      }

      // Save preference immediately (bypasses 1-second debounce)
      await preferences.saveImmediate({ notesDir: result.value });
    } catch (e) {
      store.loading = false;
      toast.error("Failed to set new directory");
    } finally {
      store.loading = false;
    }
  }

  async function importTheme() {
    store.loading = true;
    try {
      const result = await window.chronicles.selectThemeFile();
      if (!result.value) {
        store.loading = false;
        return;
      }

      const themesDir = `${preferences.settingsDir}/themes`;
      const importResult = await window.chronicles.importThemeFile(
        result.value,
        themesDir,
      );

      if (!importResult.success) {
        const errorDetails = importResult.errors?.join("\n") ?? "Unknown error";
        toast.error(`Theme import failed:\n${errorDetails}`);
      } else {
        toast.success(`Theme "${importResult.themeName}" installed`);
        refreshThemeList();
      }
    } catch (e) {
      console.error("Error importing theme", e);
      toast.error("Failed to import theme");
    } finally {
      store.loading = false;
    }
  }

  async function refreshThemeList() {
    const themesDir = `${preferences.settingsDir}/themes`;
    const result = await window.chronicles.listAvailableThemes(themesDir);
    setAvailableThemes(result.themes);
  }

  async function deleteTheme(name: string) {
    const themesDir = `${preferences.settingsDir}/themes`;
    const deleted = await window.chronicles.deleteThemeByName(name, themesDir);
    if (deleted) {
      toast.success(`Theme "${name}" removed`);
      // Reset to system default if the deleted theme was active
      if (preferences.themeLightName === name) {
        preferences.themeLightName = "System Light";
      }
      if (preferences.themeDarkName === name) {
        preferences.themeDarkName = "System Dark";
      }
      refreshThemeList();
    } else {
      toast.error(`Could not remove theme "${name}"`);
    }
  }

  function openThemesDir() {
    const themesDir = `${preferences.settingsDir}/themes`;
    window.chronicles.openPath(themesDir);
  }

  function openFontsDir() {
    const fontsDir = `${preferences.settingsDir}/fonts`;
    window.chronicles.openPath(fontsDir);
  }

  async function importDirectory() {
    store.loading = true;
    try {
      const result = await window.chronicles.openDialogSelectDir();
      if (!result?.value) {
        store.loading = false;
        return;
      }

      toast.info("Importing directory...this may take a few minutes");
      const report = await client.importer.import(
        result.value,
        store.sourceType,
        store.sourceType === SourceType.Chronicles
          ? { onConflict: store.replaceExisting ? "replace" : "skip" }
          : undefined,
      );

      await journalsStore.refresh();

      if (report) {
        console.warn("Chronicles import report", report);
        toast.success(
          `Import completed: created ${report.created}, skipped ${report.skipped}, replaced ${report.replaced}, errored ${report.errored.length}`,
        );

        const duplicateCount = Object.keys(report.duplicates).length;
        if (
          report.errored.length > 0 ||
          duplicateCount > 0 ||
          report.attachments.missing.length > 0
        ) {
          toast.warning(
            `Import had issues: ${report.errored.length} errored, ${duplicateCount} duplicate ids, ${report.attachments.missing.length} missing attachments. See console for details.`,
          );
        }
      } else {
        toast.success("Import completed");
      }
      store.loading = false;

      // Navigate to main view to show newly imported documents
      // window.location.hash = "#/";
    } catch (e) {
      console.error("Error importing directory", e);
      store.loading = false;
      toast.error("Failed to import directory");
    }
  }

  function timestampForDirName(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  async function exportNotes() {
    store.loading = true;
    try {
      const result = await window.chronicles.openDialogSelectDir();
      if (!result?.value) {
        store.loading = false;
        return;
      }

      const destDir = `${result.value}/chronicles-export-${timestampForDirName()}`;

      toast.info("Exporting notes...this may take a few minutes");
      const report = await client.export.export(destDir);

      toast.success(
        `Export completed: ${report.notes} notes, ${report.attachments.copied} attachments copied to ${report.destDir}`,
      );
      if (report.attachments.missing.length > 0) {
        toast.warning(
          `Export had ${report.attachments.missing.length} missing attachments. See console for details.`,
        );
        console.warn("Export missing attachments", report.attachments.missing);
      }
    } catch (e) {
      console.error("Error exporting notes", e);
      toast.error("Failed to export notes");
    } finally {
      store.loading = false;
    }
  }

  async function resetNotes() {
    if (
      !confirm(
        "Delete ALL notes, journals, and import records? Attachments are kept. This cannot be undone.",
      )
    )
      return;
    await maintenanceStore.resetNotes();
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent variant="fullish">
        <DialogHeader className="min-w-0">
          <DialogTitle className="sticky">Settings</DialogTitle>
          <Separator />
          <DialogDescription asChild>
            <div className="min-w-0">
              <Section>
                <SectionTitle
                  title="Appearance"
                  sub="Customize the look and feel of Chronicles"
                />

                <div className="my-4 flex justify-between">
                  <div className="text-foreground-strong mb-2 font-medium">
                    <Label.Base>Appearance</Label.Base>
                  </div>
                  <NativeSelect
                    value={preferences.darkMode}
                    onChange={(e) =>
                      (preferences.darkMode = e.target.value as
                        | "light"
                        | "dark"
                        | "system")
                    }
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </NativeSelect>
                </div>

                <div className="my-4 flex justify-between">
                  <div className="text-foreground-strong mb-2 font-medium">
                    Light Theme
                  </div>
                  <NativeSelect
                    value={preferences.themeLightName}
                    onChange={(e) =>
                      (preferences.themeLightName = e.target.value)
                    }
                  >
                    {availableThemes
                      .filter((t) => t.mode === "light" || t.mode === "both")
                      .map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                  </NativeSelect>
                </div>

                <div className="my-4 flex justify-between">
                  <div className="text-foreground-strong mb-2 font-medium">
                    Dark Theme
                  </div>
                  <NativeSelect
                    value={preferences.themeDarkName}
                    onChange={(e) =>
                      (preferences.themeDarkName = e.target.value)
                    }
                  >
                    {availableThemes
                      .filter((t) => t.mode === "dark" || t.mode === "both")
                      .map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                  </NativeSelect>
                </div>

                {/* Code theme selection hidden until Plate's code_line collapse
                    bug is fixed — see https://github.com/cloverich/chronicles/issues/176
                <div className="my-4 flex justify-between">
                  <div className="text-foreground-strong mb-2 font-medium">
                    Code Theme (Light)
                  </div>
                  <NativeSelect
                    value={preferences.codeThemeLight || "github"}
                    onChange={(e) =>
                      (preferences.codeThemeLight = e.target.value)
                    }
                  >
                    {hljsThemes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="my-4 flex justify-between">
                  <div className="text-foreground-strong mb-2 font-medium">
                    Code Theme (Dark)
                  </div>
                  <NativeSelect
                    value={preferences.codeThemeDark || "github-dark"}
                    onChange={(e) =>
                      (preferences.codeThemeDark = e.target.value)
                    }
                  >
                    {hljsThemes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </NativeSelect>
                </div>
                */}

                <div className="my-4 flex justify-between">
                  <div>
                    <div className="text-foreground-strong mb-1 font-medium">
                      Import Theme
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Install a custom theme from a <code>.theme.json</code>{" "}
                      file
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={importTheme}
                    disabled={store.loading}
                    loading={store.loading}
                  >
                    Import theme
                  </Button>
                </div>

                {availableThemes.some((t) => !t.builtin && !t.bundled) && (
                  <div className="my-4">
                    <div className="text-foreground-strong mb-2 font-medium">
                      Installed Themes
                    </div>
                    <div className="space-y-1">
                      {availableThemes
                        .filter((t) => !t.builtin && !t.bundled)
                        .map((t) => (
                          <div
                            key={t.name}
                            className="flex items-center justify-between rounded px-2 py-1.5 text-sm"
                          >
                            <span>
                              {t.name}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({t.mode})
                              </span>
                            </span>
                            <button
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => deleteTheme(t.name)}
                              title={`Remove ${t.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="my-4">
                  <Button variant="ghost" size="sm" onClick={openThemesDir}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Open themes folder</span>
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Fonts"
                  sub="Customize fonts for different parts of the application"
                />

                <div className="space-y-6">
                  <FontSelector
                    label="Heading"
                    description="Hubot Sans (bundled) - Main headings and titles"
                    value={preferences.fonts?.heading || "Hubot Sans (bundled)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.heading = font;
                    }}
                  />

                  <FontSelector
                    label="Heading 2"
                    value={preferences.fonts?.heading2 || "Default (Heading)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.heading2 =
                        font === "Default (Heading)" ? undefined : font;
                    }}
                    isSpecific={true}
                  />
                  <FontSelector
                    label="Heading 3"
                    value={preferences.fonts?.heading3 || "Default (Heading)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.heading3 =
                        font === "Default (Heading)" ? undefined : font;
                    }}
                    isSpecific={true}
                  />
                  <FontSelector
                    label="Title"
                    description="Editor document title (front matter)"
                    value={preferences.fonts?.title || "Default (Heading)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.title =
                        font === "Default (Heading)" ? undefined : font;
                    }}
                    isSpecific={true}
                  />
                  <FontSelector
                    label="Body"
                    description="Interface and content text"
                    value={preferences.fonts?.body || "Mona Sans (bundled)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.body = font;
                    }}
                  />
                  <FontSelector
                    label="Mono"
                    description="Code blocks and dates"
                    value={preferences.fonts?.mono || "IBM Plex Mono (bundled)"}
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.mono = font;
                    }}
                  />
                  <FontSelector
                    label="System Body"
                    description="Interface elements, sidebar, preferences"
                    value={
                      preferences.fonts?.systemBody || "Mona Sans (bundled)"
                    }
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.systemBody = font;
                    }}
                  />
                  <FontSelector
                    label="System Heading"
                    description="Interface section titles and headers"
                    value={
                      preferences.fonts?.systemHeading || "Hubot Sans (bundled)"
                    }
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.systemHeading = font;
                    }}
                  />
                  <FontSelector
                    label="Search Body"
                    description="Note titles on the search page (defaults to System Body)"
                    value={
                      preferences.fonts?.searchBody || "Mona Sans (bundled)"
                    }
                    options={availableFonts}
                    onChange={(font) => {
                      preferences.fonts.searchBody = font;
                    }}
                  />
                </div>

                <div className="my-4">
                  <Button variant="ghost" size="sm" onClick={openFontsDir}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Open fonts folder</span>
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Font Sizes"
                  sub="Accepts any CSS size value (e.g. 1rem, 18px, 1.5em)"
                />
                <div className="space-y-4">
                  <WidthSelector
                    label="Search"
                    description="Note titles and date headings on the search page"
                    value={preferences.fontSizes?.search || ""}
                    placeholder="Default: 16px"
                    onChange={(e) => {
                      preferences.fontSizes.search = e.target.value;
                    }}
                  />
                  <WidthSelector
                    label="Body"
                    description="Editor paragraphs and inline text"
                    value={preferences.fontSizes?.body || ""}
                    placeholder="Default: 1rem"
                    onChange={(e) => {
                      preferences.fontSizes.body = e.target.value;
                    }}
                  />
                  <WidthSelector
                    label="Title"
                    description="Editor document title (front matter)"
                    value={preferences.fontSizes?.title || ""}
                    placeholder="Default: 3rem"
                    onChange={(e) => {
                      preferences.fontSizes.title = e.target.value;
                    }}
                  />
                  <WidthSelector
                    label="Heading"
                    description="Editor H1 in content (H2, H3 scale proportionally)"
                    value={preferences.fontSizes?.heading || ""}
                    placeholder="Default: 1.5rem"
                    onChange={(e) => {
                      preferences.fontSizes.heading = e.target.value;
                    }}
                  />
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Max Width"
                  sub="Customize the max-width of different parts of the application"
                />

                <div className="space-y-6">
                  <div>
                    <div className="space-y-4">
                      <WidthSelector
                        label="Prose"
                        description="Max-width for text content"
                        value={preferences.maxWidth?.prose || ""}
                        onChange={(e) => {
                          preferences.maxWidth.prose = e.target.value;
                        }}
                      />
                      <WidthSelector
                        label="Code"
                        description="Max-width for code blocks"
                        value={preferences.maxWidth?.code || ""}
                        placeholder="Defaults to Prose width ^"
                        onChange={(e) => {
                          preferences.maxWidth.code = e.target.value;
                        }}
                      />
                      <WidthSelector
                        label="Front Matter"
                        description="Max-width for title and front matter"
                        value={preferences.maxWidth?.frontmatter || ""}
                        placeholder="Defaults to Prose width ^"
                        onChange={(e) => {
                          preferences.maxWidth.frontmatter = e.target.value;
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Section>
              <Section>
                <div className="flex items-center justify-between">
                  <SectionTitle
                    title="Reset appearance"
                    sub="Reset all appearance settings to Chronicles defaults (themes, fonts, font sizes, max widths)"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      Object.assign(
                        preferences,
                        structuredClone(APPEARANCE_DEFAULTS),
                      );
                      toast.success("Appearance settings reset to defaults");
                    }}
                  >
                    Reset to defaults
                  </Button>
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
                  <dd className="text-muted-foreground mb-2 text-xs">
                    <code>{settingsPath}</code>
                  </dd>

                  <dt className="text-foreground-strong font-medium">
                    Database file
                  </dt>
                  <dd className="text-muted-foreground mb-2 text-xs">
                    <code>{preferences.databaseUrl}</code>
                  </dd>

                  <dt className="text-foreground-strong font-medium">
                    Notes directory
                  </dt>
                  <dd className="text-muted-foreground mb-2 text-xs">
                    <code>{preferences.notesDir}</code>
                  </dd>
                </dl>
                {/* todo: https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js/29105404#29105404 */}
                <div className="mt-4 flex">
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
                  <summary className="cursor-pointer outline-hidden">
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

                <div className="my-6 flex max-w-[500px] flex-col space-y-2">
                  <Label.Base className="text-sm leading-none font-medium">
                    Import Type
                  </Label.Base>
                  <p className="text-muted-foreground text-[0.8rem]">
                    Whether to use the Notion specific parser, which checks for
                    ids in titles and pseudo-front matter in content.
                  </p>
                  <NativeSelect
                    className="w-[200px]"
                    value={store.sourceType}
                    onChange={(e) =>
                      (store.sourceType = e.target.value as SourceType)
                    }
                  >
                    <option value={SourceType.Notion}>Notion</option>
                    <option value={SourceType.Other}>Other</option>
                    <option value={SourceType.Chronicles}>Chronicles</option>
                  </NativeSelect>
                </div>
                {store.sourceType === SourceType.Chronicles && (
                  <div className="my-4 flex max-w-[500px] items-center gap-2">
                    <input
                      type="checkbox"
                      id="replace-existing"
                      checked={store.replaceExisting}
                      onChange={(e) =>
                        (store.replaceExisting = e.target.checked)
                      }
                    />
                    <Label.Base
                      htmlFor="replace-existing"
                      className="text-sm leading-none font-medium"
                    >
                      Replace existing notes with the same ID
                    </Label.Base>
                  </div>
                )}
                <div className="mt-4 flex">
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
                  title="Export notes"
                  sub="Export every note as Markdown, with frontmatter and referenced attachments"
                />
                <p className="mb-2 max-w-[500px]">
                  Writes every note as{" "}
                  <code>&lt;journal&gt;/&lt;id&gt;.md</code> with full
                  frontmatter, plus a manifest and copies of referenced
                  attachments. Suitable for backing up with Git, or re-importing
                  later.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="ghost"
                    loading={store.loading}
                    disabled={store.loading}
                    onClick={exportNotes}
                    size="sm"
                  >
                    Export notes…
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Backups"
                  sub="Verified snapshots of notes and attachments, kept in a folder you choose"
                />
                <p className="mb-2 max-w-[500px]">
                  Chronicles snapshots your notes once a day when they change,
                  keeps a tiered history, and can restore any snapshot.
                </p>
                <div className="mt-4 flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      props.onClose();
                      navigate("/backups");
                    }}
                  >
                    Open backups
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Reset notes"
                  sub="Delete every note, journal, and import record"
                />
                <p className="mb-2 max-w-[500px]">
                  <strong>(Advanced)</strong> Wipes the database so an import
                  can be re-run from scratch. Files in <code>_attachments</code>{" "}
                  are left in place; a re-import skips attachments that already
                  exist. Back up first.
                </p>
                <div className="mt-4 flex">
                  <Button
                    variant="destructive"
                    onClick={resetNotes}
                    disabled={store.loading || maintenanceStore.isRepairing}
                  >
                    Reset notes
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="Repair"
                  sub="Regenerate search index, note links, and image references"
                />
                <p className="mb-2 max-w-[500px]">
                  Your notes live in the SQLite database at{" "}
                  <code>{preferences.databaseUrl}</code>. Repair regenerates the
                  search index, note links, and image references from those
                  stored notes — use it if search results look wrong.
                </p>
                <div className="mt-4 flex">
                  <Button
                    variant="ghost"
                    loading={maintenanceStore.isRepairing}
                    disabled={maintenanceStore.isRepairing}
                    onClick={() => maintenanceStore.repair()}
                  >
                    Repair
                  </Button>
                </div>
              </Section>
              <Section>
                <SectionTitle
                  title="About Chronicles"
                  sub="Version details and user-visible changes"
                />
                <div className="mt-4 flex">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      props.onClose();
                      navigate("/changelog");
                    }}
                  >
                    View changelog
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
  return <hr className="bg-border my-8 h-px border-0" />;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0 text-lg font-medium">{title}</h3>
      {sub && <p className="text-muted-foreground text-sm">{sub}</p>}
    </div>
  );
}

function Section(props: PropsWithChildren<any>) {
  return (
    <div className="border-border mt-4 mb-10 border-b pb-8">
      {props.children}
    </div>
  );
}

const BUNDLED_FONT_OPTIONS = [
  "Hubot Sans (bundled)",
  "Mona Sans (bundled)",
  "Archivo (bundled)",
  "IBM Plex Mono (bundled)",
];

const GENERIC_FONT_OPTIONS = ["sans-serif", "serif", "monospace"];

const FONT_OPTION_VALUES: Record<string, string> = {
  "sans-serif":
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  monospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
  "Hubot Sans (bundled)":
    '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  "Mona Sans (bundled)":
    '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  "Archivo (bundled)":
    '"Archivo", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  "IBM Plex Mono (bundled)":
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
};

const FONT_VALUE_TO_OPTION = new Map(
  Object.entries(FONT_OPTION_VALUES).map(([option, storedValue]) => [
    storedValue,
    option,
  ]),
);

function decodeLegacyCustomFontValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        return parsed.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getStoredFontValue(option: string): string {
  return FONT_OPTION_VALUES[option] ?? option;
}

function getDisplayFontValue(value: string): string {
  const trimmed = value.trim();

  return (
    FONT_VALUE_TO_OPTION.get(trimmed) ??
    decodeLegacyCustomFontValue(trimmed) ??
    trimmed
  );
}

function FontSelector({
  label,
  description,
  value,
  onChange,
  options,
  isSpecific = false,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (font: string) => void;
  options: string[];
  isSpecific?: boolean;
}) {
  const allOptions = [
    ...(isSpecific ? ["Default (Heading)"] : []),
    ...BUNDLED_FONT_OPTIONS,
    ...options,
    ...GENERIC_FONT_OPTIONS,
  ];

  const dedupedOptions = Array.from(new Set(allOptions));
  const displayValue = getDisplayFontValue(value);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(getStoredFontValue(e.target.value));
  };

  return (
    <div className="flex justify-between">
      <div className="mb-2">
        <Label.Base className="text-sm font-medium">{label}</Label.Base>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <NativeSelect value={displayValue} onChange={handleChange}>
        {dedupedOptions.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function WidthSelector({
  label,
  description,
  ...rest
}: {
  label: string;
  description: string;
} & InputProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="mb-2">
        <Label.Base className="text-sm font-medium">{label}</Label.Base>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Input className="max-w-[250px]" {...rest} />
    </div>
  );
}

function NativeSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string },
) {
  const { className = "", ...rest } = props;
  return (
    <select
      className={`border-muted-foreground/30 bg-background text-foreground self-center rounded-md border px-2 py-1 text-sm ${className}`}
      {...rest}
    />
  );
}

export default PreferencesPane;
