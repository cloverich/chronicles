import { vi } from "vitest";
import type { BackupStatus, RunResult, SnapshotSummary } from "../backup/types";
import {
  PREFERENCES_DEFAULTS,
  type IPreferences,
} from "../electron/preferences-types";
import type { Maintenance } from "../hooks/useMaintenance";
import type { Settings } from "../hooks/useSettings";

/** In-memory Settings; every method is a spy. */
export function fakeSettings(initial: Partial<IPreferences> = {}): Settings {
  let store: IPreferences = { ...PREFERENCES_DEFAULTS, ...initial };
  return {
    get: vi.fn(
      async (key: keyof IPreferences) => store[key],
    ) as Settings["get"],
    all: vi.fn(async () => ({ ...store })),
    setMany: vi.fn(async (partial: Partial<IPreferences>) => {
      store = { ...store, ...partial };
    }),
    location: vi.fn(async () => "/tmp/settings/settings.json"),
  };
}

const NO_BACKUPS: BackupStatus = {
  destination: null,
  lastSuccess: null,
  lastFailure: null,
  lastRestore: null,
  pendingRestore: null,
  changedSinceLastSnapshot: null,
  newest: null,
  liveDataInSyncFolder: null,
};

/** Maintenance that does nothing: no backups set up, empty reports. */
export function fakeMaintenance() {
  return {
    importNotes: vi.fn(async () => undefined),
    exportNotes: vi.fn(async ({ dir }: { dir: string }) => ({
      destDir: dir,
      notes: 0,
      attachments: { copied: 0, missing: [] },
    })),
    rebuildDerived: vi.fn(async () => ({ count: 0 })),
    resetLibrary: vi.fn(async () => {}),
    backups: {
      status: vi.fn(async (): Promise<BackupStatus> => NO_BACKUPS),
      list: vi.fn(async (): Promise<SnapshotSummary[]> => []),
      pickDestination: vi.fn(async () => NO_BACKUPS),
      runNow: vi.fn(async (): Promise<RunResult> => {
        throw new Error("no destination");
      }),
      restore: vi.fn(async (id: string) => ({ scheduled: id })),
    },
  } satisfies Maintenance;
}
