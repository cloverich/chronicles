import { expect } from "chai";
import fs from "fs";
import { describe, it } from "mocha";
import path from "path";
import yaml from "yaml";

import { slateToString, stringToSlate } from "./index.js";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";
import {
  dedent,
  dig,
  parseMarkdown,
  parseMarkdownForImport,
} from "./test-utils.js";

// Tests can structure the data this way and use runTests to
// test the various conversions.
interface TestDoc {
  markdown: string | { in: string; out: string };
  mdast?: Record<string, any>;
  slate?: Record<string, any>;
}

function isStringMarkdown(
  // If markdown is a string, the test case implies the processing does not
  // alter the source document
  // Otherwise, this indicates the source markdown will be altered by processing
  // typical example: italic is converted from _italic_ to *italic* or
  // <https://example.com> to [https://example.com](https://example.com)
  markdown: string | { in: string; out: string },
): markdown is string {
  return typeof markdown === "string";
}

function inputMarkdown(markdown: string | { in: string; out: string }) {
  return isStringMarkdown(markdown) ? markdown : markdown.in;
}

function outputMarkdown(markdown: string | { in: string; out: string }) {
  return isStringMarkdown(markdown) ? markdown : markdown.out;
}

// Tests:
// - roundtrips (markdown->mdast->slate->mdast->markdown)
//  - when { in: string; out: string } is provided, it means the roundtrip
//    will not be exact. This is usually by design of the parser
//    https://github.com/syntax-tree/mdast-util-to-markdown/blob/main/lib/unsafe.js
//    but is sometimes configurable (ex: options -> bullet)
// - markdown (string)->mdast
// - markdown (string)->slate
function runTests(doc: TestDoc, parser = parseMarkdown) {
  it("roundtrips", function () {
    const result = slateToString(stringToSlate(inputMarkdown(doc.markdown)));

    // serializing adds a newline at the end - this is ok, but we don't
    // need all tests appending \n to the expected value.
    expect(result.trim()).to.equal(outputMarkdown(doc.markdown));
  });

  // optionally validate mdast and slate conversions, because markdown will also
  // round trip properly if it does not parse at all (ex: wikilinks without a handler)
  if (doc.mdast) {
    it("markdown->mdast", function () {
      const result = parser(inputMarkdown(doc.markdown));
      expect(result).to.deep.equal(doc.mdast);
    });
  }

  if (doc.slate) {
    it("markdown->slate", function () {
      const result = stringToSlate(outputMarkdown(doc.markdown), parser);
      expect(result).to.deep.equal(doc.slate);
    });
  }
}

describe("Slate processing", function () {
  describe("empty document", function () {
    it("produces default slate nodes when content is empty", function () {
      const result = stringToSlate("");
      expect(result).to.deep.equal([{ type: "p", children: [{ text: "" }] }]);
    });
  });

  describe("full document roundtrip", function () {
    const markdown = fs.readFileSync(
      path.join(__dirname, "test-docs", "misc.md"),
      { encoding: "utf8" },
    );

    it("parses and serializes unaltered", function () {
      const slate = stringToSlate(markdown.toString());
      const result = slateToString(slate);
      // todo: should not need trim; needed to add after paragraph patching fix
      // (adds trailing paragraph; wraps top-level leaf nodes in paragraph)
      expect(result.trim()).to.equal(markdown.toString().trim());
    });
  });

  describe("a basic paragraph", function () {
    const doc = {
      markdown: "A basic paragraph",
      mdast: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "A basic paragraph" }],
          },
        ],
      },
      slate: [{ type: "p", children: [{ text: "A basic paragraph" }] }],
    };

    runTests(doc);
  });

  it("basic marks", function () {
    // NOTE: converts italic from _italic_ to *italic*
    // NOTE: Parse or stringify introduces newlines, likely because of the paragraph
    // this can be visualized with JSON.stringify(result)
    const doc = {
      markdown:
        "This is *italic text* and **bold text** and ~~struck through text~~ and `code text`",
      mdast: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", value: "This is " },
              {
                type: "emphasis",
                children: [{ type: "text", value: "italic text" }],
              },
              { type: "text", value: " and " },
              {
                type: "strong",
                children: [{ type: "text", value: "bold text" }],
              },
              { type: "text", value: " and " },
              {
                type: "delete",
                children: [{ type: "text", value: "struck through text" }],
              },
              { type: "text", value: " and " },
              { type: "inlineCode", value: "code text" },
            ],
          },
        ],
      },
      slate: [
        {
          type: "p",
          children: [
            { text: "This is " },
            { italic: true, text: "italic text" },
            { text: " and " },
            { bold: true, text: "bold text" },
            { text: " and " },
            { strikethrough: true, text: "struck through text" },
            { text: " and " },
            { code: true, text: "code text" },
          ],
        },
      ],
    };

    runTests(doc);
  });

  describe("links", function () {
    it("<https://topstartups.io/>", function () {
      const mdast = parseMarkdown("<https://topstartups.io/>");
      expect(mdast).to.deep.equal({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: "https://topstartups.io/",
                title: null,
                children: [
                  {
                    type: "text",
                    value: "https://topstartups.io/",
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it(`[Top Startups](https://topstartups.io/ "And a title")`, function () {
      const mdast = parseMarkdown(
        `[Top Startups](https://topstartups.io/ "And a title")`,
      );
      expect(mdast).to.deep.equal({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: "https://topstartups.io/",
                title: "And a title",
                children: [
                  {
                    type: "text",
                    value: "Top Startups",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  describe("Images", function () {
    // features/image-group
    describe("image grouping", function () {
      const doc = {
        markdown:
          "![75d97cd0e4b3f42f58aa80cefab00fec\\_res.jpeg](../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg)\n![75d97cd0e4b3f42f58aa80cefab00fec\\_res.jpeg](../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg)",
        slate: [
          {
            type: "imageGalleryElement",
            children: [
              {
                type: "img",
                url: "chronicles://../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
                title: undefined,
                alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                caption: [
                  {
                    text: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                  },
                ],
                children: [
                  {
                    text: "",
                  },
                ],
              },
              {
                type: "img",
                url: "chronicles://../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
                title: undefined,
                alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                caption: [
                  {
                    text: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                  },
                ],
                children: [
                  {
                    text: "",
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    describe("stand-alone images", function () {
      const doc = {
        markdown:
          "![75d97cd0e4b3f42f58aa80cefab00fec\\_res.jpeg](../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg)",
        mdast: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "image",
                  url: "../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
                  title: null,
                  alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                },
              ],
            },
          ],
        },
        slate: [
          {
            type: "img",
            url: "chronicles://../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
            title: undefined,
            alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
            caption: [
              {
                text: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
              },
            ],
            children: [
              {
                text: "",
              },
            ],
          },
          // paragraph patching adds trailing paragraph to slate
          {
            type: "p",
            children: [{ text: "" }],
          },
        ],
      };

      runTests(doc);
    });
  });

  describe("note links", function () {
    describe("stand-alone", function () {
      const doc = {
        markdown:
          "[Behavioral Interview Prep](../research/01931c56fc2378079233d986767c519c.md)",
        mdast: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: "../research/01931c56fc2378079233d986767c519c.md",
                  title: null,
                  children: [
                    {
                      type: "text",
                      value: "Behavioral Interview Prep",
                    },
                  ],
                },
              ],
            },
          ],
        },
        slate: [
          {
            type: "p",
            children: [
              {
                journalName: "research",
                noteId: "01931c56fc2378079233d986767c519c",
                title: "",
                type: "noteLinkElement",
                url: "../research/01931c56fc2378079233d986767c519c.md",
                children: [
                  {
                    text: "Behavioral Interview Prep",
                  },
                ],
              },
            ],
          },
        ],
      };

      runTests(doc);
    });

    describe("empty title", function () {
      const doc = {
        markdown: "[](../research/01931c56fc2378079233d986767c519c.md)",
        mdast: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: "../research/01931c56fc2378079233d986767c519c.md",
                  title: null,
                  children: [],
                },
              ],
            },
          ],
        },
        slate: [
          {
            type: "p",
            children: [
              {
                journalName: "research",
                noteId: "01931c56fc2378079233d986767c519c",
                title: "",
                type: "noteLinkElement",
                url: "../research/01931c56fc2378079233d986767c519c.md",
                children: [
                  {
                    text: "",
                  },
                ],
              },
            ],
          },
        ],
      };

      runTests(doc);
    });
  });
});

describe("paragraph patching", function () {
  it("wraps top-level text nodes in paragraph", function () {
    expect(
      mdastToSlate({
        type: "root",
        children: [
          {
            type: "text",
            value: "shoot",
          },
        ],
      }),
    ).to.deep.equal([{ type: "p", children: [{ text: "shoot" }] }]);
  });

  it("ensures trailing node is always a paragraph", () => {
    expect(
      mdastToSlate({
        type: "root",
        children: [
          {
            type: "image",
            url: "../_attachments/abc123.jpg",
          },
        ],
      }),
    ).to.deep.equal([
      {
        type: "img",
        url: "chronicles://../_attachments/abc123.jpg",
        caption: [{ text: "" }],
        children: [{ text: "" }],
        alt: undefined,
        title: undefined,
      },
      { type: "p", children: [{ text: "" }] },
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
  const doc = {
    markdown: {
      in: "a [[link]] [[link.md]] [[link#hash]] [[link#hash|alias]] ![[link]] ![[link.md]] ![[link#hash]] ![[link#hash|alias]] ![[Document.pdf#page=3]] b",
      // note: because we currently treat wikilinks as raw text, the output escapes the brackets; they won't be parsed as ofmwikilink's the second time around
      out: "a \\[\\[link]] \\[\\[link.md]] \\[\\[link#hash]] \\[\\[link#hash|alias]] !\\[\\[link]] !\\[\\[link.md]] !\\[\\[link#hash]] !\\[\\[link#hash|alias]] !\\[\\[Document.pdf#page=3]] b",
    },

    mdast: {
      type: "root",
      children: [
        {
          type: "paragraph",

          children: [
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
            {
              type: "ofmWikiembedding",
              value: "link",
              url: "link.md",
              hash: "",
            },
            { type: "text", value: " " },
            {
              type: "ofmWikiembedding",
              value: "link",
              url: "link",
              hash: "hash",
            },
            { type: "text", value: " " },
            {
              type: "ofmWikiembedding",
              value: "alias",
              url: "link",
              hash: "hash",
            },
            { type: "text", value: " " },
            {
              type: "ofmWikiembedding",
              value: "Document",
              url: "Document.pdf",
              hash: "page=3",
            },
            { type: "text", value: " b" },
          ],
        },
      ],
    },

    // todo: Implement its just a bunch of { text } nodes,
    // then leave follow-up issue marker
    slate: [
      {
        type: "p",
        children: [
          {
            text: "a [[link]] [[link.md]] [[link#hash]] [[link#hash|alias]] ![[link]] ![[link.md]] ![[link#hash]] ![[link#hash|alias]] ![[Document.pdf#page=3]] b",
          },
        ],
      },
    ],
  };

  runTests(doc, parseMarkdownForImport);
});

describe("mdast-util-ofm-tag", async () => {
  const doc = {
    markdown: "a #b c",
    mdast: {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "a " },
            { type: "ofmTag", value: "b" },
            { type: "text", value: " c" },
          ],
        },
      ],
    },
  };

  runTests(doc, parseMarkdownForImport);
});

// A place to put behavior that is not yet handled correctly; so I can store test
// cases as I discover issues, making it easier to fix in the future when I have less
// context.
describe("Known issues / limitations", function () {
  it("should not convert _italic_ to *italic*", function () {
    const doc = { markdown: "This is _italic text_" };
    runTests(doc);
  });

  // In this test, I found that if the document has images with no other content, since I unwrap images from paragraphs
  // i.e. (<p><img/></p> -> <img/>), this confuses the markdown context and it ends up stripping all newlines in the output
  // for whatever reason. Removing image unwrap fixes this problem (but introduces others), so I can try and re-wrap them then
  // use this test to verify the fix.
  it("does not collapse newlines when naked images", function () {
    const markdown = `![alt text](https://example1.com)\n\n![alt text](https://example2.com)\n\n# Paragraph\n\nSome text\n`;
    const actual = slateToString(stringToSlate(markdown));
    expect(actual).to.equal(markdown);
  });

  it("should not escape underscore in image title", function () {
    const doc = {
      markdown:
        // todo: When within a paragraph, the mdast->string conversion is adding an escape to underscores in titles
        // so title_1 -> title\_1
        // by placing two backslashes here, it passes the test, but this is not the expected behavior.
        // Note how in the second test (not within a paragraph), the title is not escaped. shrug.
        // NOTE: Oh, this is a known issue, maybe a wontfix:
        // https://github.com/syntax-tree/mdast-util-to-markdown/issues/65
        "An image: ![75d97cd0e4b3f42f58aa80cefab00fec\\_res.jpeg](../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg)",
      mdast: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                value: "An image: ",
              },
              {
                type: "image",
                url: "../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
                title: null,
                alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
              },
            ],
          },
        ],
      },
      slate: [
        {
          type: "p",
          children: [
            { text: "An image: " },
            {
              type: "img",
              url: "chronicles://../_attachments/01931c56fdb076a292f80193b27f02bb.jpeg",
              title: null,
              alt: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
              caption: [
                {
                  text: "75d97cd0e4b3f42f58aa80cefab00fec_res.jpeg",
                },
              ],
              children: [
                {
                  text: "",
                },
              ],
            },
          ],
        },
      ],
    };

    runTests(doc);
  });
});

// Edge cases that actually came up in my notes (usually import / export related); ideally
// can isolate the issue from the fuller example
describe("Whacky shit", function () {
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

  // choice examples from my Notion export
  // Here's what it looks like after I imported it:
  const weirdLinks = `

[](Jobs%20Search%202022%2087ddab10364d4332bdb83cc0ba9a9204/Jobs%20list%205302084b0c3e47108cc999b2552bcf1a.md)

[Resume Deep Dive and Behavioral Questions Q\&A](../research/01931c56ff38755ca829d73b74a150a7.md)

****[5 variations of Binary search (A Self Note)](https://leetcode.com/discuss/interview-question/1322500/5-variations-of-Binary-search-\(A-Self-Note\))****
`;

  // Here is what it looks like in the Notion export:
  const weirdLinksNotion = `
[](Jobs%20Search%202022%2087ddab10364d4332bdb83cc0ba9a9204/Jobs%20list%205302084b0c3e47108cc999b2552bcf1a.md) 

[Resume Deep Dive and Behavioral Questions Q&A](Resume%20Deep%20Dive%20and%20Behavioral%20Questions%20Q&A%20c83beed68bcb45e7b88398a6fd7d0ff9.md) 

****[5 variations of Binary search (A Self Note)](https://leetcode.com/discuss/interview-question/1322500/5-variations-of-Binary-search-(A-Self-Note))****`;
});

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
