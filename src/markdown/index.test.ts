import { describe, it } from "mocha";
import { expect } from "chai";
import { stringToSlate } from "./";

// NOTE: I Never actually ran this because I can't get mocha to work...
// TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /Users/cloverich/code/pragma/src/markdown/index.test.ts
// ...although I have ts-node/register, esm, etc. Need to research...
// ...this ecosystem is quickly killing me
describe("Markdown to Slate conversion", function () {
  it("unnests image tags", function () {
    const input = `
I have a few ideas to record:

-   My first idea 
-   My second idea
-   My third idea is \_nested\_

    -   It seems to work!



Now lets add an image: 

![](ckure3z1b00003u65tfr1m2ki..png)

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
                    text: "_",
                  },
                  {
                    text: "nested",
                  },
                  {
                    text: "_",
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
        url: "chronicles://ckure3z1b00003u65tfr1m2ki..png",
        title: null,
        alt: null,
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

describe("Heading conversion", function () {
  it('parses markdown headings from type: "heading" sections to "h1" or "h2');
  it(
    'serializes markdown headings from type: "h1", "h2", to type: "heading" with correct depth'
  );
});
