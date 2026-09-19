import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import { createId } from "../preload/client/util";
import { isSameOrInside, pathExists } from "./fs-guards";

export interface BackupReport {
  destDir: string;
  databaseBytes: number;
  attachments: { files: number; bytes: number };
}

interface BackupManifest {
  version: 1;
  backedUpAt: string;
  database: string;
  attachments: string;
}

const DATABASE_FILENAME = "chronicles.db";
const ATTACHMENTS_DIRNAME = "_attachments";

async function walkDirStats(
  dir: string,
): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDirStats(fullPath);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      const stat = await fs.promises.stat(fullPath);
      files++;
      bytes += stat.size;
    }
  }

  return { files, bytes };
}

export class BackupClient {
  constructor(
    private sqlite: Database.Database,
    private notesDir: string,
  ) {}

  backup = async (destDir: string): Promise<BackupReport> => {
    const resolvedDest = path.resolve(destDir);
    const resolvedNotesDir = path.resolve(this.notesDir);

    if (await pathExists(resolvedDest)) {
      throw new Error(
        `[BACKUP_DEST_EXISTS] Backup destination already exists: ${resolvedDest}`,
      );
    }

    if (
      isSameOrInside(resolvedDest, resolvedNotesDir) ||
      isSameOrInside(resolvedNotesDir, resolvedDest)
    ) {
      throw new Error(
        `[BACKUP_DEST_CONFLICT] Backup destination must not be inside (or contain) the notes directory: ${resolvedDest}`,
      );
    }

    const tmpDir = path.join(
      path.dirname(resolvedDest),
      "." + path.basename(resolvedDest) + ".tmp-" + createId(),
    );

    try {
      await fs.promises.mkdir(tmpDir, { recursive: true });

      const report = await this.writeBackup(tmpDir);

      await fs.promises.rename(tmpDir, resolvedDest);

      return { destDir: resolvedDest, ...report };
    } catch (err) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
      throw err;
    }
  };

  private writeBackup = async (
    tmpDir: string,
  ): Promise<Omit<BackupReport, "destDir">> => {
    const dbDestPath = path.join(tmpDir, DATABASE_FILENAME);
    // Escape single quotes for the VACUUM INTO string literal.
    const escapedDbDestPath = dbDestPath.replace(/'/g, "''");
    this.sqlite.exec(`VACUUM INTO '${escapedDbDestPath}'`);
    const dbStat = await fs.promises.stat(dbDestPath);

    const attachmentsSourceDir = path.join(this.notesDir, ATTACHMENTS_DIRNAME);
    const attachmentsDestDir = path.join(tmpDir, ATTACHMENTS_DIRNAME);

    let attachments = { files: 0, bytes: 0 };
    if (await pathExists(attachmentsSourceDir)) {
      await fs.promises.cp(attachmentsSourceDir, attachmentsDestDir, {
        recursive: true,
      });
      attachments = await walkDirStats(attachmentsDestDir);
    }

    const manifest: BackupManifest = {
      version: 1,
      backedUpAt: new Date().toISOString(),
      database: DATABASE_FILENAME,
      attachments: ATTACHMENTS_DIRNAME,
    };

    await fs.promises.writeFile(
      path.join(tmpDir, "backup.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );

    return {
      databaseBytes: dbStat.size,
      attachments,
    };
  };
}
