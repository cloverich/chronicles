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
import Titlebar from "../../titlebar/macos";
import { formatAge } from "../backups";
import * as Base from "../layout";

const STATE_LABELS: Record<PublishRow["state"], string> = {
  draft: "Draft",
  published: "Published",
  edited: "Changed since publish",
  orphaned: "Note deleted",
};

const STATE_ORDER: PublishRow["state"][] = [
  "edited",
  "draft",
  "published",
  "orphaned",
];

/**
 * Every note in the blog journal and every post in the blog folder, with
 * whether the post is current (spec/publish.md, "Publication state").
 */
export default function Blog() {
  const maintenance = useMaintenance();
  const appState = useApplicationStore();
  const navigate = useNavigate();
  const [overview, setOverview] = React.useState<BlogOverview | null>(null);
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

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function publish(rows: PublishRow[]) {
    let written = 0;
    for (const row of rows) {
      setBusy(row.id);
      try {
        await maintenance.publishNote({ id: row.id });
        written++;
      } catch (err) {
        toast.error(
          `${row.title ?? row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    setBusy(null);
    if (written > 0) {
      toast.success(
        `Wrote ${written === 1 ? "1 post" : `${written} posts`}. Run the blog's publish script to put it live.`,
      );
    }
    await refresh();
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
              loading={busy !== null}
              onClick={() => publish(edited)}
            >
              Publish all changes
              {edited.length > 0 ? ` (${edited.length})` : ""}
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
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-muted-foreground text-xs">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Title</th>
                    <th className="py-1 pr-4 font-normal">Status</th>
                    <th className="py-1 pr-4 font-normal">Edited</th>
                    <th className="py-1 pr-4 font-normal">Post</th>
                    <th className="py-1 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort(
                      (a, b) =>
                        STATE_ORDER.indexOf(a.state) -
                        STATE_ORDER.indexOf(b.state),
                    )
                    .map((row) => (
                      <tr key={row.id} className="border-border border-t">
                        <td className="py-1 pr-4">
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
                        </td>
                        <td
                          className={`py-1 pr-4 whitespace-nowrap ${row.state === "edited" ? "text-foreground-strong font-medium" : "text-muted-foreground"}`}
                        >
                          {STATE_LABELS[row.state]}
                        </td>
                        <td className="text-muted-foreground py-1 pr-4 whitespace-nowrap">
                          {row.updatedAt ? formatAge(row.updatedAt, now) : "—"}
                        </td>
                        <td className="py-1 pr-4 font-mono text-xs">
                          {row.url ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                            loading={busy === row.id}
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
}
