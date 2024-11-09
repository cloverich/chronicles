import { expect } from "chai";
import { updatedDiff } from "deep-object-diff";
import { describe, it } from "mocha";
import { stringToMdast, stringToSlate } from "./";

// Often asserting against sub-sets of the mdast tree
// Usage: getNestedProperty(mdast, ["children", 0, "children", 1, "children", 0, "value"])
function dig(obj: any, ...path: (string | number)[]) {
  return path.reduce((acc, key, index) => {
    if (acc && key in acc) {
      return acc[key];
    } else {
      throw new Error(
        `'.dig' errored at step "${key}" (index ${index})\n` +
          `Requested path: ${path.join(" -> ")}\n` +
          `Object at prior step: ${JSON.stringify(acc, null, 2)}`,
      );
    }
  }, obj);
}

describe("Markdown to Slate conversion", function () {
  it("unnests image tags", function () {
    const input = `
I have a few ideas to record:

-   My first idea 
-   My second idea
-   My third idea is \_nested\_

    -   It seems to work!



Now lets add an image: 

![](ckure3z1b00003u65tfr1m2ki.png)

This works! _Seriously_, no **complaints**.

`;

    const slateDOM = [
      {
        type: "p",
        children: [
          {
            text: "I have a few ideas to record:",
          },
        ],
      },
      {
        type: "ul",
        children: [
          {
            type: "li",
            children: [
              {
                type: "lic",
                children: [
                  {
                    text: "My first idea ",
                  },
                ],
              },
            ],
            checked: null,
            spread: false,
          },
          {
            type: "li",
            children: [
              {
                type: "lic",
                children: [
                  {
                    text: "My second idea",
                  },
                ],
              },
            ],
            checked: null,
            spread: false,
          },
          {
            type: "li",
            children: [
              {
                type: "lic",
                children: [
                  {
                    text: "My third idea is ",
                  },
                  {
                    // todo: I expected this to be escaped; it is escaped if I use similar syntax in the editor.
                    italic: true,
                    text: "nested",
                  },
                ],
              },
              {
                type: "ul",
                children: [
                  {
                    type: "li",
                    children: [
                      {
                        type: "lic",
                        children: [
                          {
                            text: "It seems to work!",
                          },
                        ],
                      },
                    ],
                    checked: null,
                    spread: false,
                  },
                ],
                ordered: false,
                start: null,
                spread: false,
              },
            ],
            checked: null,
            spread: true,
          },
        ],
        ordered: false,
        start: null,
        spread: false,
      },
      {
        type: "p",
        children: [
          {
            text: "Now lets add an image: ",
          },
        ],
      },
      {
        type: "img",
        url: "chronicles://ckure3z1b00003u65tfr1m2ki.png",
        title: null,
        alt: null,
        caption: [
          {
            text: "",
          },
        ],
        children: [
          {
            text: "",
          },
        ],
      },
      {
        type: "p",
        children: [
          {
            text: "This works! ",
          },
          {
            italic: true,
            text: "Seriously",
          },
          {
            text: ", no ",
          },
          {
            bold: true,
            text: "complaints",
          },
          {
            text: ".",
          },
        ],
      },
    ];

    const parsed = stringToSlate(input);
    expect(parsed).to.deep.equal(slateDOM);
  });
});

// Because I am adding custom Wikilink parsing, I need basic tests for the
// existing markdown parsing.
describe("Reference Links: [text][id] and ![alt][id] and [id]: url", () => {
  it("[text][id]", function () {
    const markdown = `[My Title][mylink1]`;
    const actual = dig(stringToMdast(markdown), "children", 0);
    expect(actual).to.not.be.undefined;

    const expected = {
      type: "paragraph",
      children: [
        {
          type: "linkReference",
          identifier: "mylink1",
          label: "mylink1",
          children: [{ value: "My Title", type: "text" }],
        },
      ],
    };

    const diffResult = updatedDiff(expected, actual);
    expect(diffResult).to.deep.equal({});
  });

  it("![alt][id]", function () {
    const markdown = `![My Title][mylink1]`;
    const actual = dig(stringToMdast(markdown), "children", 0);
    expect(actual).to.not.be.undefined;

    const expected = {
      type: "paragraph",
      children: [
        {
          type: "imageReference",
          identifier: "mylink1",
          label: "mylink1",
          alt: "My Title",
          children: [],
        },
      ],
    };

    const diffResult = updatedDiff(expected, actual);
    expect(diffResult).to.deep.equal({});
  });

  it("[title][id] + [id]: url", function () {
    const markdown = `[My Title][mylink1] \n\n [mylink1]: https://example.com`;
    const actual = stringToMdast(markdown);
    expect(actual).to.not.be.undefined;

    // first child [0] is the paragraphw/ the linkReference; we want the definition
    // since we check linkReference in prior test
    const definition = dig(actual, "children", 1);
    const expected = {
      type: "definition",
      identifier: "mylink1",
      label: "mylink1",
      url: "https://example.com",
      title: null,
    };

    expect(updatedDiff(expected, definition)).to.deep.equal({});
  });
});

describe("[[Wikilinks]]", function () {
  it("[[Standard wikilinks]] are converted to internal links", function () {
    const markdown = `[[wikilink]]`;
    const slate = stringToMdast(markdown);
    // console.log(slate);
    console.log(slate.children[0].children);
    // { text: 'Hello\n I am a [' },
    // {
    //   type: 'linkReference',
    //   children: [ [Object] ],
    //   referenceType: 'shortcut',
    //   identifier: 'wikilink',
    //   label: 'wikilink'
    // },
    // { text: ']' }
  });

  // Aliased wikilinks
  it("[[Aliases|Nicknames]]");
  it("[[Aliases|Nicknames]]");
  // wikilink to a block
  it("[[2023-01-01#^quote-of-the-day]]");

  // wikilink to a heading
  it("[[Obsidian#Links are first-class citizens]]");

  // Embedded wikilinks (note is embedded in a note)
  it("![[Internal links]]");
  it("![[Engelbart.jpg]]");
  it("![[Engelbart.jpg|100x145]]");
  it("![[Document.pdf#page=3]]");
  it("![[Document.pdf#height=400]]");
});

describe("Heading conversion", function () {
  it('parses markdown headings from type: "heading" sections to "h1" or "h2');
  it(
    'serializes markdown headings from type: "h1", "h2", to type: "heading" with correct depth',
  );
});
