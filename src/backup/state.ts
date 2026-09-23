import fs from "fs";
import path from "path";
import { tempName } from "./pool";
import type { BackupOutcome, RestoreOutcome } from "./types";

/**
 * Backup state owned by the main process, in its own file beside the app's
 * settings. The renderer's preferences API cannot write it, so the only way
 * to set `destination` is the native picker.
 */
export interface BackupState {
  destination?: string;
  lastSuccess?: BackupOutcome;
  lastFailure?: BackupOutcome;
  lastRestore?: RestoreOutcome;
  pendingRestore?: string;
}

export async function readState(file: string): Promise<BackupState> {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeState(
  file: string,
  state: BackupState,
): Promise<void> {
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, tempName("backup-state"));
  await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
  });
  await fs.promises.rename(tmp, file);
}

export async function updateState(
  file: string,
  patch: (s: BackupState) => BackupState,
): Promise<BackupState> {
  const next = patch(await readState(file));
  await writeState(file, next);
  return next;
}
