import React, { useContext } from "react";
import type { ExportOptions, ExportReport } from "../node-client/export";
import type { ChroniclesImportReport } from "../node-client/importer-chronicles";
import type { PublishStatus } from "../node-client/publish";
import type { BackupsApi } from "../preload/backups";
import type { SourceType } from "../preload/client/importer/SourceType";

export type { ChroniclesImportReport, ExportReport, PublishStatus };

/**
 * Whole-library operations: import, export, repair, reset, and backups.
 * Host-specific (paths, a native folder picker), so it lives beside
 * PlatformServices rather than in the contract. Errors arrive as NotesErrors
 * (see `hydrateService`); a host without a capability rejects with
 * `unsupported`.
 */
export interface Maintenance {
  /**
   * A Chronicles import returns a report; other sources return nothing.
   * `dir` may also be a single-file (.chronicles.zip) Chronicles export.
   */
  importNotes(req: {
    dir: string;
    source: SourceType;
    onConflict?: "skip" | "replace";
  }): Promise<ChroniclesImportReport | void>;
  /** Writes a folder or a single-file export of all or chosen journals. */
  exportNotes(req: { dest: string } & ExportOptions): Promise<ExportReport>;
  /** Regenerates search, links, and attachment references from notes. */
  rebuildDerived(): Promise<{ count: number }>;
  /** Deletes all notes, journals, and import records; leaves a default journal. */
  resetLibrary(): Promise<void>;
  backups: BackupsApi;
  /**
   * Blog publishing (spec/publish.md), configured by the `blog` preference.
   * Null when no blog folder is set, or the note is outside the blog journal.
   */
  publishStatus(req: { id: string }): Promise<PublishStatus | null>;
  /** Writes the note's post folder into the blog folder. */
  publishNote(req: { id: string }): Promise<PublishStatus>;
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
