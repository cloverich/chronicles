import { Journals } from "./journals";
import { PrismaClient } from "@prisma/client";

export interface Handlers {
  journals: Journals;
}

export default function handlers(): Handlers {
  const client = new PrismaClient();
  return {
    journals: new Journals(client),
  };
}
