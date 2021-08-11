import { Journals } from "./journals";
import { DocumentsHandler } from "./documents";
import { PrismaClient } from "@prisma/client";

export interface Handlers {
  journals: Journals;
  documents: DocumentsHandler;
}

export default function handlers(): Handlers {
  const client = new PrismaClient();
  return {
    journals: new Journals(client),
    documents: new DocumentsHandler(client),
  };
}
