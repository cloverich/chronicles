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

  readDocument = async (filepath: string): Promise<string> => {
    return fs.promises.readFile(filepath, "utf8");
  };

  uploadDocument = async (
    document: { id: string; content: string },
    journal: string,
  ): Promise<string> => {
    const journalPath = path.join(this.notesDir, journal);
    const docPath = path.join(journalPath, `${document.id}.md`);

    // Guard against path traversal
    if (!path.resolve(docPath).startsWith(path.resolve(journalPath))) {
      throw new Error("Invalid path: Directory traversal attempt detected.");
    }

    await fs.promises.mkdir(journalPath, { recursive: true });
    await fs.promises.writeFile(docPath, document.content);
    return docPath;
  };

  deleteDocument = async (documentId: string, journal: string): Promise<void> => {
    const docPath = path.join(this.notesDir, journal, `${documentId}.md`);
    await fs.promises.unlink(docPath);
  };

  validFile = async (
    filepath: string,
    propagateErr: boolean = true,
  ): Promise<boolean> => {
    try {
      const file = await fs.promises.stat(filepath);
      if (!file.isFile()) return false;
      await fs.promises.access(filepath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (err: any) {
      if (err.code !== "ENOENT" && propagateErr) throw err;
      return false;
    }
  };
}
