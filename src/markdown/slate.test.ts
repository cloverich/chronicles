import { expect } from "chai";
import mdast from "mdast";
import { describe, it } from "mocha";
import { parseMarkdown } from "./index.js";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";

function unwrapImages(tree: mdast.Root) {
  tree.children = tree.children.map((child) => {
    if (
      child.type === "paragraph" &&
      child.children.length === 1 &&
      child.children[0].type === "image"
    ) {
      return child.children[0];
    }
    return child;
  });

  return tree;
}

describe("Mdast -> Slate", function () {
  describe("basic tests", function () {
    it("parses a simple paragraph", function () {
      const input = "This is a simple paragraph";
      const result = mdastToSlate(parseMarkdown(input));
      expect(result).to.deep.equal([
        { type: "p", children: [{ text: "This is a simple paragraph" }] },
      ]);
    });
  });

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
                    text: "My first idea",
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
            text: "Now lets add an image:",
          },
        ],
      },
      {
        type: "img",
        url: "chronicles://ckure3z1b00003u65tfr1m2ki.png",
        title: null,
        alt: "",
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

    const parsed = mdastToSlate(unwrapImages(parseMarkdown(input)));
    expect(parsed).to.deep.equal(slateDOM);
  });
});
