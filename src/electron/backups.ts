import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { Backups, createBackups } from "../backup/index";
import { backupQueries } from "../node-client/backup-queries";
import type { Settings } from "./settings.js";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Wires the backup module into the main process. The renderer reaches it
 * only through the IPC channels below; none of them accepts a path. The
 * destination comes from the native picker, and restore takes a snapshot
 * name that the module validates against what it listed.
 */
export function createAppBackups(opts: {
  userDataDir: string;
  databasePath: string;
  settings: Settings;
  getWindow: () => BrowserWindow | null;
}): Backups {
  return createBackups({
    ...backupQueries,
    appVersion: app.getVersion(),
    databasePath: opts.databasePath,
    attachmentsDir: () =>
      path.join(opts.settings.get("notesDir"), "_attachments"),
    stateFile: path.join(opts.userDataDir, "backups.json"),
    pickFolder: async () => {
      const win = opts.getWindow();
      const options: Electron.OpenDialogOptions = {
        title: "Choose a backup folder",
        message:
          "Chronicles keeps snapshots in a chronicles folder inside the folder you choose.",
        buttonLabel: "Use Folder",
        properties: ["openDirectory", "createDirectory"],
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
  });
}

/**
 * Runs a restore scheduled in the previous session. Call before anything
 * opens the database: the module refuses if another connection holds it.
 */
export async function applyPendingRestore(backups: Backups): Promise<void> {
  try {
    const result = await backups.applyPendingRestore();
    if (result) {
      console.log("[backups] restored snapshot", result.snapshot, result);
    }
  } catch (err) {
    console.error("[backups] scheduled restore failed", err);
  }
}

export function registerBackupIpc(backups: Backups): void {
  ipcMain.handle("backups:status", () => backups.status());
  ipcMain.handle("backups:list", () => backups.list());
  ipcMain.handle("backups:pick-destination", () => backups.pickDestination());
  ipcMain.handle("backups:run", () => backups.run("manual"));
  ipcMain.handle("backups:restore", async (_event, snapshotId: unknown) => {
    if (typeof snapshotId !== "string") {
      throw new Error("[BACKUP_NOT_FOUND] Invalid snapshot name.");
    }
    await backups.scheduleRestore(snapshotId);
    // Relaunch so the swap happens at startup, before the database opens.
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 250);
    return { scheduled: snapshotId };
  });
}

/** Activity trigger: at launch, then hourly while the app runs. */
export function startActivityBackups(backups: Backups): () => void {
  const tick = () => {
    backups.run("activity").then(
      (result) => {
        if (result.status === "created") {
          console.log("[backups] activity snapshot", result.snapshot.id);
        }
      },
      (err) => console.error("[backups] activity snapshot failed", err),
    );
  };
  tick();
  const timer = setInterval(tick, HOUR_MS);
  return () => clearInterval(timer);
}
