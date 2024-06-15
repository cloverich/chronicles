import { Database } from "better-sqlite3";
import { Knex } from "knex";

export type ITagsClient = TagsClient;

export class TagsClient {
  constructor(
    private db: Database,
    private knex: Knex,
  ) {}

  all = async (): Promise<string[]> => {
    return this.db
      .prepare(`SELECT DISTINCT tag FROM document_tags`)
      .all()
      .map((row) => row.tag);
  };
}
