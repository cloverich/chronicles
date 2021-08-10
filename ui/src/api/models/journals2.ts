// import { Database, recreateSchema } from "./database";
// import { Indexer } from "./indexer";
// import { Files } from "./files";
import { ValidationError } from "../errors";
import { PrismaClient } from "@prisma/client";

export interface IJournal {
  // display name
  name: string;
}

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class Journals {
  private client: PrismaClient;

  private constructor(client: PrismaClient) {
    this.client = client;
  }

  create = async (name: string) => {
    const res = await this.client.journal2.create({
      data: {
        name: "Chronicles",
      },
    });
  };

  list = async () => {
    return await this.client.journal2.findMany();
  };
}
