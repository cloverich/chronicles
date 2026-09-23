import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Backups, { formatAge, formatBytes } from ".";
import type { BackupStatus, SnapshotSummary } from "../../backup/types";

const snapshot: SnapshotSummary = {
  id: "2026-09-22T14-25-34Z",
  createdAt: "2026-09-22T14:25:34Z",
  trigger: "activity",
  appVersion: "1.0.0",
  integrity: "ok",
  counts: { documents: 12, journals: 2, tags: 4 },
  databaseBytes: 2 * 1024 * 1024,
  attachmentCount: 3,
  attachmentBytes: 512 * 1024,
  tiers: ["newest", "day"],
};

const status: BackupStatus = {
  destination: "/Users/me/Library/Mobile Documents/Backups/chronicles",
  lastSuccess: { at: "2026-09-22T14:25:34Z", trigger: "activity" },
  lastFailure: {
    at: "2026-09-21T10:00:00Z",
    trigger: "manual",
    error: "[BACKUP_BUSY] Another backup is running for this destination.",
  },
  lastRestore: null,
  pendingRestore: null,
  changedSinceLastSnapshot: true,
  newest: snapshot,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Backups />
    </MemoryRouter>,
  );
}

const unset: BackupStatus = {
  destination: null,
  lastSuccess: null,
  lastFailure: null,
  lastRestore: null,
  pendingRestore: null,
  changedSinceLastSnapshot: null,
  newest: null,
};

describe("Backups page", () => {
  beforeEach(() => {
    const api = vi.mocked(window.chronicles.backups);
    api.status.mockReset().mockResolvedValue(unset);
    api.list.mockReset().mockResolvedValue([]);
    api.runNow.mockReset();
  });

  it("shows the destination, history, and snapshot list", async () => {
    vi.mocked(window.chronicles.backups.status).mockResolvedValue(status);
    vi.mocked(window.chronicles.backups.list).mockResolvedValue([snapshot]);

    renderPage();

    expect(await screen.findByText(status.destination!)).toBeInTheDocument();
    expect(screen.getByText(/BACKUP_BUSY/)).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("newest, day")).toBeInTheDocument();
    expect(screen.getByText("2.5 MB")).toBeInTheDocument();
    expect(
      screen.getByText("12 documents, 2 journals, 4 tags, 3 attachments"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change destination…" }),
    ).toBeInTheDocument();
  });

  it("backs up on demand and refreshes", async () => {
    vi.mocked(window.chronicles.backups.status).mockResolvedValue(status);
    vi.mocked(window.chronicles.backups.list).mockResolvedValue([]);
    vi.mocked(window.chronicles.backups.runNow).mockResolvedValue({
      status: "created",
      snapshot,
    });

    renderPage();
    const button = await screen.findByRole("button", { name: "Back up now" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(window.chronicles.backups.runNow).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(window.chronicles.backups.list).toHaveBeenCalledTimes(2),
    );
  });

  it("asks for a destination before the first backup", async () => {
    renderPage();
    expect(
      await screen.findByText("Choose a destination to start backing up."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back up now" })).toBeDisabled();
  });
});

describe("formatting", () => {
  it("formats sizes and ages", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    const now = new Date("2026-09-23T12:00:00Z");
    expect(formatAge("2026-09-23T11:30:00Z", now)).toBe("30m ago");
    expect(formatAge("2026-09-22T12:00:00Z", now)).toBe("24h ago");
    expect(formatAge("2026-09-20T12:00:00Z", now)).toBe("3d ago");
  });
});
