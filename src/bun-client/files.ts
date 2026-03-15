import fs from "fs";
import path from "path";

/**
 * Minimal folder-management interface used by JournalsClient.
 * Bun-compatible replacement for the electron-store-backed FilesClient.
 */
export interface IJournalFolderOps {
  createFolder(name: string): Promise<void>;
  renameFolder(oldName: string, newName: string): Promise<void>;
  removeFolder(name: string): Promise<void>;
}

export class BunFilesClient implements IJournalFolderOps {
  constructor(private notesDir: string) {}

  createFolder = async (name: string): Promise<void> => {
    const newPath = path.join(this.notesDir, name);
    await fs.promises.mkdir(newPath, { recursive: true });
  };

  renameFolder = async (oldName: string, newName: string): Promise<void> => {
    const oldPath = path.join(this.notesDir, oldName);
    const newPath = path.join(this.notesDir, newName);
    await fs.promises.rename(oldPath, newPath);
  };

  removeFolder = async (name: string): Promise<void> => {
    const folderPath = path.join(this.notesDir, name);
    await fs.promises.rm(folderPath, { recursive: true, force: true });
  };
}
