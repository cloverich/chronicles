import React, { useContext } from "react";
import type { ExportReport } from "../node-client/export";
import type { ChroniclesImportReport } from "../node-client/importer-chronicles";
import type { BackupsApi } from "../preload/backups";
import type { SourceType } from "../preload/client/importer/SourceType";

export type { ChroniclesImportReport, ExportReport };

/**
 * Whole-library operations: import, export, repair, reset, and backups.
 * Host-specific (paths, a native folder picker), so it lives beside
 * PlatformServices rather than in the contract. Errors arrive as NotesErrors
 * (see `hydrateService`); a host without a capability rejects with
 * `unsupported`.
 */
export interface Maintenance {
  /** A Chronicles import returns a report; other sources return nothing. */
  importNotes(req: {
    dir: string;
    source: SourceType;
    onConflict?: "skip" | "replace";
  }): Promise<ChroniclesImportReport | void>;
  exportNotes(req: { dir: string }): Promise<ExportReport>;
  /** Regenerates search, links, and attachment references from notes. */
  rebuildDerived(): Promise<{ count: number }>;
  /** Deletes all notes, journals, and import records; leaves a default journal. */
  resetLibrary(): Promise<void>;
  backups: BackupsApi;
}

export const MaintenanceContext = React.createContext<Maintenance | null>(null);
MaintenanceContext.displayName = "MaintenanceContext";

export function useMaintenance(): Maintenance {
  const maintenance = useContext(MaintenanceContext);
  if (!maintenance) {
    throw new Error(
      "[chronicles] useMaintenance() called outside a MaintenanceContext",
    );
  }
  return maintenance;
}
