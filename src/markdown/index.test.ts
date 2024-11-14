import { expect } from "chai";
import mdast from "mdast";
import { describe, it } from "mocha";

import { mdastToString } from "./index.js";
import { dig, parseMarkdown } from "./test-utils.js";

describe("Sanity check", function () {
  const markdown = `
# My First Note

Here is a typical note. It has a paragraph and a [reference link][1]. I hope it works!

...Let me also check this image:
![alt text](https://example.com)

The end. Oh, without a definition for the reference link, it won't interpret
the reference link above as a linkReference. So here it is.

[1]: https://example2.com
`;

  it("parses markdown to mdast", function () {
    const mdast = parseMarkdown(markdown);
    expect(mdast).to.not.be.undefined;
  });

  it("mdast structure is correct", async function () {
    const tree = await parseMarkdown(markdown);
    expect(tree.children).to.deep.equal([
      {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "My First Note" }],
      },
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "Here is a typical note. It has a paragraph and a ",
          },
          {
            type: "linkReference",
            children: [
              {
                type: "text",
                value: "reference link",
              },
            ],
            label: "1",
            identifier: "1",
            referenceType: "full",
          },
          { type: "text", value: ". I hope it works!" },
        ],
      },
      {
        type: "paragraph",
        children: [
          { type: "text", value: "...Let me also check this image:\n" },
          {
            type: "image",
            title: null,
            url: "https://example.com",
            alt: "alt text",
          },
        ],
      },
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value:
              "The end. Oh, without a definition for the reference link, it won't interpret\n" +
              "the reference link above as a linkReference. So here it is.",
          },
        ],
      },
      {
        type: "definition",
        identifier: "1",
        label: "1",
        title: null,
        url: "https://example2.com",
      },
    ]);
  });
});

// Because I am adding custom Wikilink parsing, I feel these are most likely to screw up
describe("Reference Links", () => {
  it("Parses reference links and images", function () {
    const markdown =
      "start [My Title][mylink1] and ![alt][myimage] end\n\n [mylink1]: https://example.com\n [myimage]: https://example.com";
    const actual = dig(parseMarkdown(markdown), "children");
    expect(actual).to.deep.equal([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "start " },
          {
            type: "linkReference",
            identifier: "mylink1",
            label: "mylink1",
            referenceType: "full",
            children: [{ type: "text", value: "My Title" }],
          },
          {
            type: "text",
            value: " and ",
          },
          {
            alt: "alt",
            identifier: "myimage",
            label: "myimage",
            referenceType: "full",
            type: "imageReference",
          },
          {
            type: "text",
            value: " end",
          },
        ],
      },
      {
        type: "definition",
        identifier: "mylink1",
        label: "mylink1",
        url: "https://example.com",
        title: null,
      },
      {
        type: "definition",
        identifier: "myimage",
        label: "myimage",
        title: null,
        url: "https://example.com",
      },
    ]);
  });
});

describe("[[Wikilinks]]", function () {
  // Since I am internally forking ofm-wikilnk parsing (esm import issues), also include the test so I can
  // remove the fork later and know its still working.
  // Lifted from https://github.com/MoritzRS/obsidian-ext/blob/main/packages/mdast-util-ofm-wikilink/test/base.test.ts
  // MIT License
  it("wikilinks", async function () {
    const tree = parseMarkdown(
      "a [[link]] [[link.md]] [[link#hash]] [[link#hash|alias]] ![[link]] ![[link.md]] ![[link#hash]] ![[link#hash|alias]] ![[Document.pdf#page=3]] b",
    );

    expect(dig(tree, "children.0.children")).to.deep.equal([
      { type: "text", value: "a " },
      { type: "ofmWikilink", value: "link", url: "link", hash: "" },
      { type: "text", value: " " },
      { type: "ofmWikilink", value: "link", url: "link.md", hash: "" },
      { type: "text", value: " " },
      { type: "ofmWikilink", value: "link", url: "link", hash: "hash" },
      { type: "text", value: " " },
      { type: "ofmWikilink", value: "alias", url: "link", hash: "hash" },
      { type: "text", value: " " },
      { type: "ofmWikiembedding", value: "link", url: "link", hash: "" },
      { type: "text", value: " " },
      { type: "ofmWikiembedding", value: "link", url: "link.md", hash: "" },
      { type: "text", value: " " },
      { type: "ofmWikiembedding", value: "link", url: "link", hash: "hash" },
      { type: "text", value: " " },
      { type: "ofmWikiembedding", value: "alias", url: "link", hash: "hash" },
      { type: "text", value: " " },
      {
        type: "ofmWikiembedding",
        value: "Document",
        url: "Document.pdf",
        hash: "page=3",
      },
      { type: "text", value: " b" },
    ]);
  });
});

// while migrating to latest remark / refactoring, notes with strike throughs in various places
// were failing to stringify after parsing. Probably just a change in AST expectations.
describe("~~strikethrough~~", function () {
  it("parses strikethrough", function () {
    const tree = parseMarkdown("~~struck through text~~");
    expect(dig(tree, "children")).to.deep.equal([
      {
        type: "paragraph",
        children: [
          {
            type: "delete",
            children: [{ type: "text", value: "struck through text" }],
          },
        ],
      },
    ]);
  });

  it("serializes strikethrough", function () {
    const tree: mdast.BlockContent = {
      type: "paragraph",
      children: [
        {
          type: "delete",
          children: [{ type: "text", value: "struck through text" }],
        },
      ],
    };
    expect(mdastToString(tree)).to.equal("~~struck through text~~\n");
  });
});

describe("Heading conversion", function () {
  it('parses markdown headings from type: "heading" sections to "h1" or "h2');
  it(
    'serializes markdown headings from type: "h1", "h2", to type: "heading" with correct depth',
  );
});

describe("Whacky shit that breaks Slate", function () {
  // This crashes my _PRODUCTION_ Chronicles so its not related to the markdown changes
  // It also reminds me I DESPERATELY need a way to work this out, something like:
  // 1. ErrorBoundary so you can go back
  // 2. Display the note (File location) that errored, and the error
  // 3. Instruct user they m ay be able to modify the note, but then WHY DO I HAVE TO RECALL SYNC FOR IT TO PICK IT UP? Figure that part out!
  const bunk = `

  **~~~~**

  -   ~~Attempt to add wikilink parsing + test~~
  
      -   ~~Test is ready;~~ [~~review OFM plugin~~](https://github.com/MoritzRS/obsidian-ext)
`;
});
