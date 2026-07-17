import { expect } from "chai";
import { describe, it } from "node:test";
import yaml from "yaml";

import { dedent } from "../dedent.js";
import { parseMarkdown } from "./test-utils.js";

describe("front matter parsing", function () {
  // A very basic "it works" test
  // todo: End to end test with a real document, asserting against the database values
  it("parses front matter as an mdast node, and can be parsed with yaml.parse", function () {
    const content = dedent(`---
    title: 2024-09-29
    tags: weekly-todo
    createdAt: 2024-09-30T17:50:22.000Z
    updatedAt: 2024-11-04T16:24:11.000Z
    ---

    #weekly-todo

    Last week: [2024-09-22](../work/0193acd4fa3574698c36c4514b907c70.md)

    **I am on call this week** [On call week of 2024-09-30](../persona/0193acd4fa45731f81350d4443c1ed16.md)

    ## Monday

    `);

    const parsed = parseMarkdown(content);
    expect(parsed.children[0].type).to.equal("yaml");
    expect(parsed.children[0].value).to.equal(
      "title: 2024-09-29\n" +
        "tags: weekly-todo\n" +
        "createdAt: 2024-09-30T17:50:22.000Z\n" +
        "updatedAt: 2024-11-04T16:24:11.000Z",
    );

    const frontMatter = yaml.parse(parsed.children[0].value as string);
    expect(frontMatter).to.deep.equal({
      title: "2024-09-29",
      tags: "weekly-todo",
      createdAt: "2024-09-30T17:50:22.000Z",
      updatedAt: "2024-11-04T16:24:11.000Z",
    });
  });

  it("handles colons in front matter titles", function () {
    const content = dedent(`---
    title: "2024-09-29: A day to remember"
    ---

    Last week I...
    `);

    const parsed = parseMarkdown(content);
    const frontMatter = yaml.parse(parsed.children[0].value as string);
    expect(frontMatter).to.deep.equal({
      title: "2024-09-29: A day to remember",
    });
  });
});
