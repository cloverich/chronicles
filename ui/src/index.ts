// Server

interface NoteFinder {
  findForJournal(folderPath: string): Promise<string[]>;
}

interface Note {}
