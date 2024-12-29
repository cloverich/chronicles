import { Knex } from "knex";

export type ITagsClient = TagsClient;

export class TagsClient {
  constructor(private knex: Knex) {}

  all = async (): Promise<string[]> => {
    return this.knex("document_tags").distinct("tag").pluck("tag");
  };
}
