import { Journals } from "./journals";
import { DocumentsHandler } from "./documents";
import { PreferencesHandler } from "./preferences";
import { FilesHandler } from "./files";
import { PrismaClient } from "../../prisma/client";
import settings from "electron-settings";

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
  // Since this is a forked process, we don't have electron runtime and
  // electron-settings can't use it either. By telling settings where to look
  // it apparently won't make any other electron calls, and so this (non electron)
  // process can use electron-settings so long as it manually sets the directory
  // ...to the default, passed from the main (electron) startup process through
  // an environment variable. Wow this is getting hacky...
  if (!process.env.USER_DATA_DIR) {
    throw new Error("missing environment variable: USER_DATA_DIR");
  } else {
    console.log(
      "configuring electron-settings to use ",
      process.env.USER_DATA_DIR
    );
    settings.configure({ dir: process.env.USER_DATA_DIR });
  }

  const client = new PrismaClient();
  return {
    journals: new Journals(client),
    documents: new DocumentsHandler(client),
    preferences: new PreferencesHandler(),
    files: await FilesHandler.create(process.env.USER_DATA_DIR!),
  };
}
