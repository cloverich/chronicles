import { asc, count } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export interface TagWithCount {
  tag: string;
  count: number;
}

export type ITagsClient = TagsClient;

export class TagsClient {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  all = async (): Promise<string[]> => {
    return (await this.allWithCounts()).map((r) => r.tag);
  };

  allWithCounts = async (): Promise<TagWithCount[]> => {
    const rows = await this.db
      .select({
        tag: schema.documentTags.tag,
        count: count(schema.documentTags.documentId).as("count"),
      })
      .from(schema.documentTags)
      .groupBy(schema.documentTags.tag)
      .orderBy(asc(schema.documentTags.tag));

    return rows.map((r) => ({
      tag: r.tag,
      count: Number(r.count),
    }));
  };
}
