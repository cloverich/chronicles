import { SourceType } from "./SourceType";
import { parseTitleAndFrontMatterForImport } from "./frontmatter";

import { expect } from "chai";
import { describe, it } from "mocha";
import { dedent } from "../../../dedent.js";

export const cases = {
  [SourceType.Notion]: [
    {
      name: "Title and simple front matter with no special characters",
      input: dedent(
        `
      # My First Note

      Created By: Johnny Cage
      Last Edited: July 20, 2023 12:00 PM
      Category: personal
      createdAt: January 1, 2021
      published: Yes

      This is the body of the document.`.trim(),
      ),
      expected: {
        title: "My First Note",
        frontMatter: {
          title: "My First Note",
          tags: [],
          "Created By": "Johnny Cage",
          Category: "personal",
          createdAt: "2021-01-01T00:00:00.000Z",
          published: "Yes",
          updatedAt: "2023-07-20T12:00:00.000Z",
        },
        body: "This is the body of the document.",
      },
    },
    {
      name: "Title with no front matter",
      input: dedent(
        `
      # Another Note

      This document has no front matter, just content.`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "Another Note",
          tags: [],
        },
        body: "This document has no front matter, just content.",
      },
    },
    {
      name: "Title with front matter missing values",
      input: dedent(
        `
      # Empty Values

      Created By:
      Last Edited:
      tags:
      createdAt:
      published:

      Content for this note goes here.`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "Empty Values",
          "Created By": null,
          "Last Edited": null,
          tags: [],
          published: "",
        },
        body: "Content for this note goes here.",
      },
    },
    {
      name: "No front matter, colon in the body",
      input: dedent(
        `
      # Notion title + colon in body

      Body content has a colon: in it!`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "Notion title + colon in body",
          tags: [],
        },
        body: "Body content has a colon: in it!",
      },
    },
    {
      name: "Front matter, colon in the body",
      input: dedent(
        `
      # Notion title + front matter + colon in body

      Created By: Johnny Cage
      Last Edited: July 20, 2023 12:00 PM
      Category: personal
      createdAt: January 1, 2021
      published: Yes

      Body content has a colon: in it!`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "Notion title + front matter + colon in body",
          tags: [],
          "Created By": "Johnny Cage",
          updatedAt: "2023-07-20T12:00:00.000Z",
          Category: "personal",
          createdAt: "2021-01-01T00:00:00.000Z",
          published: "Yes",
        },
        body: "Body content has a colon: in it!",
      },
    },
    {
      name: "Front matter, no body (common in Notion databases)",
      input: dedent(
        `
      # Notion title + front matter + no body

      Created By: Johnny Cage
      Last Edited: July 20, 2023 12:00 PM
      Category: personal
      createdAt: January 1, 2021
      published: Yes`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "Notion title + front matter + no body",
          tags: [],
          "Created By": "Johnny Cage",
          updatedAt: "2023-07-20T12:00:00.000Z",
          Category: "personal",
          createdAt: "2021-01-01T00:00:00.000Z",
          published: "Yes",
        },
        body: "",
      },
    },

    {
      name: "No title, front matter has special characters",
      input: dedent(
        `
      Created By: Jane Doe
      Last Edited: July 20, 2023 12:00 PM
      Category: "work, personal"
      createdAt: January 1, 2021 8:30 AM
      published: No

      Body starts here and has no title.`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "",
          tags: [],
        },
        body: dedent(
          `
        Created By: Jane Doe
        Last Edited: July 20, 2023 12:00 PM
        Category: "work, personal"
        createdAt: January 1, 2021 8:30 AM
        published: No

        Body starts here and has no title.`.trim(),
        ),
      },
    },

    // Nah. https://github.com/cloverich/chronicles/issues/256
    //   {
    //     name: "Title with multi-line front matter",
    //     input: `# Project Plan
    // Created By: "Chris O"
    // Last Edited: July 25, 2023 9:45 PM
    // Category: project
    // createdAt: February 15, 2021 10:30 AM
    // description: >
    //   This project plan outlines the goals and milestones
    //   for the next quarter.

    // The body of the project plan begins here.`,
    //     expected: {
    //       title: "Project Plan",
    //       frontMatter: {
    //         'Created By': "Chris O",
    //         'Last Edited': "July 25, 2023 9:45 PM",
    //         Category: "project",
    //         createdAt: "February 15, 2021 10:30 AM",
    //         description:
    //           "This project plan outlines the goals and milestones for the next quarter.",
    //       },
    //       body: "The body of the project plan begins here.",
    //     },
    //   },
  ],
  [SourceType.Other]: [
    {
      name: "Title, tags (JSON aray syntax), body",
      input: dedent(
        `
      ---
      title: What chronicles was
      tags: [tags, thesixthprototype]
      createdAt: 2024-06-30T14:19:17.801Z
      updatedAt: 2024-07-02T04:52:50.639Z
      ---
      
      foo`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "What chronicles was",
          tags: ["tags", "thesixthprototype"],
          createdAt: "2024-06-30T14:19:17.801Z",
          updatedAt: "2024-07-02T04:52:50.639Z",
        },
        body: "foo\n",
      },
    },
    {
      name: "Title, tags (YAML aray syntax), body",
      input: dedent(
        `
      ---
      title: What chronicles was
      tags: 
        - mytag
        - thesixthprototype
      createdAt: 2024-06-30T14:19:17.801Z
      updatedAt: 2024-07-02T04:52:50.639Z
      ---
      
      foo`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "What chronicles was",
          tags: ["mytag", "thesixthprototype"],
          createdAt: "2024-06-30T14:19:17.801Z",
          updatedAt: "2024-07-02T04:52:50.639Z",
        },
        body: "foo\n",
      },
    },
    {
      name: "Title, tags, no body",
      input: dedent(
        `
        ---
        title: What chronicles was
        tags:
          - tags, thesixthprototype
        createdAt: 2024-06-30T14:19:17.801Z
        updatedAt: 2024-07-02T04:52:50.639Z
        ---
        `.trim(),
      ),
      expected: {
        frontMatter: {
          title: "What chronicles was",
          // note: it doesnt fix old-style tags (comma-separated)
          tags: ["tags, thesixthprototype"],
          createdAt: "2024-06-30T14:19:17.801Z",
          updatedAt: "2024-07-02T04:52:50.639Z",
        },
        body: "",
      },
    },
    {
      name: "tag + wikilink in body -> no error",
      input: dedent(
        `---
        title: What chronicles was
        ---

        This is some content with a #tag and a [[wikilink]].`.trim(),
      ),
      expected: {
        frontMatter: {
          title: "What chronicles was",
          tags: [],
        },
        body: "This is some content with a #tag and a [[wikilink]].\n",
      },
    },
    {
      name: "Empty contents",
      input: "",
      expected: {
        frontMatter: {
          title: "",
          tags: [],
        },
        body: "",
      },
    },
  ],
};

describe("Frontmatter parsing", () => {
  for (const sourceType of Object.keys(cases)) {
    describe(sourceType, () => {
      for (const testCase of cases[sourceType as SourceType]) {
        it(testCase.name, () => {
          const parsed = parseTitleAndFrontMatterForImport(
            dedent(testCase.input),
            "",
            sourceType as SourceType,
          );
          expect(parsed.frontMatter).to.deep.equal(
            testCase.expected.frontMatter,
          );
          expect(parsed.body).to.equal(testCase.expected.body);
        });
      }
    });
  }

  // note: Rather than trying to repair front matter issues, like colons in values (title),
  // I ended up manually fixing in my source (imported) documents; leaving this breadcrumb
  // here in case I want to revisit this later.
  // it("colons in front matter values", () => {
  //   const parsedDoc = parseDocument(
  //     `title: 2024-01-01: a  new year\ncreatedAt: 2024-01-01:00:00:00\n`,
  //   );
  //   console.log(parsedDoc.errors[0].linePos); // code: BLOCK_AS_IMPLICIT_KEY, pos: [7,8], [ { line: 1, col: 8 }, { line: 1, col: 9 } ]
  //   const parsed = parseTitleAndFrontMatterForImport(
  //     dedent(`---
  //     title: 2024-01-01: A new year
  //     ---
  //     `),
  //     "",
  //     SourceType.Other,
  //   );
  // });
});
