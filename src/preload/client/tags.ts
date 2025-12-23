import { Knex } from "knex";

export type ITagsClient = TagsClient;

export interface TagWithCount {
  tag: string;
  count: number;
}

export class TagsClient {
  constructor(private knex: Knex) {}

  all = async (): Promise<string[]> => {
    return this.knex("document_tags").distinct("tag").pluck("tag");
  };

  allWithCounts = async (): Promise<TagWithCount[]> => {
    const results = await this.knex("document_tags")
      .select("tag")
      .count("documentId as count")
      .groupBy("tag")
      .orderBy("tag", "asc");

    return results.map((row: any) => ({
      tag: row.tag,
      count: Number(row.count),
    }));
  };
}
