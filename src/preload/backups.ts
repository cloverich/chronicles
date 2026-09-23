import { ipcRenderer } from "electron";
import type { BackupStatus, RunResult, SnapshotSummary } from "../backup/types";

/**
 * Renderer access to backups. No call takes a path: the destination is set
 * only by the native picker in the main process, and restore takes a
 * snapshot name from `list()`.
 */
export const backups = {
  status: (): Promise<BackupStatus> => ipcRenderer.invoke("backups:status"),
  list: (): Promise<SnapshotSummary[]> => ipcRenderer.invoke("backups:list"),
  pickDestination: (): Promise<BackupStatus> =>
    ipcRenderer.invoke("backups:pick-destination"),
  runNow: (): Promise<RunResult> => ipcRenderer.invoke("backups:run"),
  /** Schedules a restore and relaunches the app to apply it. */
  restore: (snapshotId: string): Promise<{ scheduled: string }> =>
    ipcRenderer.invoke("backups:restore", snapshotId),
};

export type BackupsApi = typeof backups;
