import { Journals } from "./journals";
import { DocumentsHandler } from "./documents";
import { PreferencesHandler } from "./preferences";
import { FilesHandler } from "./files";
import { PrismaClient } from "../../prisma/client";

export interface Handlers {
  journals: Journals;
  documents: DocumentsHandler;
  preferences: PreferencesHandler;
  files: FilesHandler;
}

/**
 * Setup API route handlers (construction, initialization, validation, DI)
 */
export default async function handlers(): Promise<Handlers> {
  // Because we can't access electron-settings in this forked process,
  // rely on this environment variable for the location of user_files
  if (!process.env.USER_FILES_DIR) {
    console.error(process.env);
    throw new Error(
      "handlers setup is missing environment variable: USER_FILES_DIR"
    );
  }

  const client = new PrismaClient();
  return {
    journals: new Journals(client),
    documents: new DocumentsHandler(client),
    preferences: new PreferencesHandler(),
    files: new FilesHandler(process.env.USER_FILES_DIR!),
  };
}
