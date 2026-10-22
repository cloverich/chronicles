import { toJS } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { useApplicationStore } from "../../hooks/useApplicationStore";
import {
  useMaintenance,
  type BlogOverview,
  type PublishRow,
} from "../../hooks/useMaintenance";
import { usePlatform } from "../../hooks/usePlatform";
import { usePreferences } from "../../hooks/usePreferences";
import Titlebar from "../../titlebar/macos";
import { formatAge } from "../backups";
import * as Base from "../layout";

const STATE_LABELS: Record<PublishRow["state"], string> = {
  draft: "Draft",
  published: "Published",
  edited: "Changed since publish",
  orphaned: "Note deleted",
};

/**
 * Last edit, else creation; older libraries can carry a missing or unparseable
 * updatedAt.
 */
export function formatEdited(row: PublishRow, now: Date): string {
  for (const iso of [row.updatedAt, row.createdAt]) {
    if (iso && !Number.isNaN(new Date(iso).getTime())) {
      return formatAge(iso, now);
    }
  }
  return "Unknown";
}

/**
 * Every note in the blog journal and every post in the blog folder, with
 * whether the post is current (spec/publish.md, "Publication state").
 */
export default observer(function Blog() {
  const maintenance = useMaintenance();
  const platform = usePlatform();
  const preferences = usePreferences();
  const appState = useApplicationStore();
  const navigate = useNavigate();
  const [overview, setOverview] = React.useState<BlogOverview | null>(null);
  /** The row being published, or "all". Buttons only disable while busy. */
  const [busy, setBusy] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setOverview(await maintenance.blogOverview());
    } catch (err) {
      setOverview({
        configured: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  // Re-read when Preferences > Blog changes, e.g. via Blog settings… here.
  const blogPrefs = JSON.stringify(toJS(preferences.blog) ?? null);
  React.useEffect(() => {
    refresh();
  }, [refresh, blogPrefs]);

  async function publish(rows: PublishRow[], all = false) {
    let written = 0;
    for (const row of rows) {
      setBusy(all ? "all" : row.id);
      try {
        await maintenance.publishNote({ id: row.id });
        written++;
      } catch (err) {
        toast.error(
          `${row.title ?? row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    await refresh();
    setBusy(null);
    if (written > 0) {
      toast.success(
        `Wrote ${written === 1 ? "1 post" : `${written} posts`}. Run the blog's publish script to put it live.`,
      );
    }
  }

  const rows = overview?.configured ? overview.rows : [];
  const edited = rows.filter((r) => r.state === "edited");
  const now = new Date();

  return (
    <Base.Container>
      <Titlebar className="pr-16">
        <IconButton
          variant="minimal"
          className="drag-none"
          icon="chevron-left"
          onClick={() => navigate("/documents")}
          aria-label="Back"
        />
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>
        <main className="mx-auto w-full max-w-5xl px-8 py-10">
          <h1 className="text-foreground-strong mb-2 text-3xl font-semibold">
            Blog
          </h1>
          <p className="text-muted-foreground mb-8 max-w-[600px] text-sm">
            Publish writes a post folder into your blog folder. Changed means
            the note was edited after its last publish, on this device or
            another. The site's own script puts posts live.
          </p>

          <dl className="mb-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Blog folder</dt>
            <dd className="m-0 min-w-0">
              {overview?.configured ? (
                <code className="break-all">{overview.root}</code>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Blog journal</dt>
            <dd className="m-0">
              {overview?.configured ? (
                overview.journal
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </dd>
          </dl>

          <div className="mb-10 flex gap-2">
            <Button
              variant="default"
              disabled={edited.length === 0 || busy !== null}
              onClick={() => publish(edited, true)}
            >
              {busy === "all"
                ? "Publishing…"
                : `Publish all changes${edited.length > 0 ? ` (${edited.length})` : ""}`}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => appState.togglePreferences(true)}
            >
              Blog settings…
            </Button>
          </div>

          {overview && !overview.configured ? (
            <p className="text-muted-foreground font-mono text-sm">
              {overview.reason}.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm">
              {overview ? "No notes in the blog journal yet." : "Loading…"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-sm">
                {/* Fixed widths, and every row has the post line, so
                    publishing never resizes a column or a row. Title takes
                    the rest and truncates. */}
                <colgroup>
                  <col />
                  <col className="w-44" />
                  <col className="w-24" />
                  <col className="w-36" />
                </colgroup>
                <thead className="text-muted-foreground text-xs">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Title and post</th>
                    <th className="py-1 pr-4 font-normal">Status</th>
                    <th className="py-1 pr-4 font-normal">Edited</th>
                    <th className="py-1 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-border border-t">
                      <td className="truncate py-1 pr-4">
                        {row.state === "orphaned" ? (
                          <span className="text-muted-foreground">
                            {row.id}
                          </span>
                        ) : (
                          <button
                            className="text-left hover:underline"
                            onClick={() =>
                              navigate(`/documents/edit/${row.id}`)
                            }
                          >
                            {row.title || "Untitled"}
                          </button>
                        )}
                        {row.journal &&
                          overview?.configured &&
                          row.journal.toLowerCase() !==
                            overview.journal.toLowerCase() && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              in {row.journal}
                            </span>
                          )}
                        <div className="truncate font-mono text-xs">
                          {row.path && overview?.configured ? (
                            <button
                              className="text-muted-foreground max-w-full truncate text-left hover:underline"
                              title="Show in Finder"
                              onClick={() =>
                                platform.openPath(
                                  `${overview.root}/${row.path}`,
                                )
                              }
                            >
                              {row.url ?? row.path}
                            </button>
                          ) : (
                            <span className="text-muted-foreground/60">
                              Not published
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`truncate py-1 pr-4 ${row.state === "edited" ? "text-foreground-strong font-medium" : "text-muted-foreground"}`}
                      >
                        {busy === row.id ||
                        (busy === "all" && row.state === "edited")
                          ? "Publishing…"
                          : STATE_LABELS[row.state]}
                      </td>
                      <td className="text-muted-foreground truncate py-1 pr-4">
                        {formatEdited(row, now)}
                      </td>
                      <td className="py-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            busy !== null ||
                            row.state === "published" ||
                            row.state === "orphaned"
                          }
                          onClick={() => publish([row])}
                        >
                          {row.state === "edited"
                            ? "Publish changes"
                            : "Publish"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </Base.ScrollContainer>
    </Base.Container>
  );
});
