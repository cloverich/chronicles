// todo drop this diff lib if migrated to mocha
import { diff } from "deep-object-diff";
import { SourceType } from "./SourceType";
import { parseTitleAndFrontMatterForImport } from "./frontmatter";

import { expect } from "chai";
import { describe, it } from "mocha";
import { dedent } from "../../../markdown/test-utils";

// to the console; can convert to real tests at the end.
// todo(chris): Finish refactoring all these tests to be run with Mocha
// they are left over from some manual testing that required preload
// i.e could not be run via mocha
function runFrontmatterTests() {
  for (const testCase of titleFrontMatterTestCases) {
    it(testCase.input, () => {
      expect(testCase.input).to.be.a("string");
    });

    const result = parseTitleAndFrontMatterForImport(
      testCase.input,
      "Dont use this title",
      SourceType.Notion,
    );

    if (!result.frontMatter) {
      console.error("FAILED:", testCase.expected.title);
      console.error("FAILED No front matter parsed");
      console.error(testCase.input);
      break;
    } else {
      if (result.frontMatter.title !== testCase.expected.title) {
        console.error("FAILED:", testCase.expected.title);
        console.error("FAILED title");
        console.error("We should have:", testCase.expected.title);
        console.error("We got:", result.frontMatter.title);
        console.error();
        break;
      }

      if (result.body !== testCase.expected.body) {
        console.error("FAILED:", testCase.expected.title);
        console.error("FAILED parsing body");
        console.error("We should have:", testCase.expected.body);
        console.error("We got:", result.body);
        console.error();
        break;
      }

      // expect(result.frontMatter).to.deep.equal(testCase.expected.frontMatter);

      const difference = diff(
        result.frontMatter,
        testCase.expected.frontMatter,
      );
      if (Object.keys(difference).length) {
        console.error("FAILED:", testCase.expected.title);
        console.error("FAILED parsing front matter");
        console.error(difference);
        console.error("^ was diff, was it useless? lets log json instead...");
        console.error(
          "Should have (string):",
          JSON.stringify(testCase.expected.frontMatter),
        );
        console.error("We got (string):", JSON.stringify(result.frontMatter));
        console.error("We should have:", testCase.expected.frontMatter);
        console.error("We got:", result.frontMatter);
        break;
      }

      console.info("SUCCESS: ", testCase.expected.title);
      console.info();
      console.info();
    }
  }
}

export const titleFrontMatterTestCases = [
  // Title and simple front matter with no special characters
  {
    input: `# My First Note

Created By: John Doe
Last Edited: July 20, 2023 12:00 PM
Category: personal
createdAt: January 1, 2021
published: Yes

This is the body of the document.`,
    expected: {
      title: "My First Note",
      frontMatter: {
        "Created By": "John Doe",
        Category: "personal",
        createdAt: "2021-01-01T08:00:00.000Z",
        published: "Yes",
        updatedAt: "2023-07-20T19:00:00.000Z",
      },
      body: "This is the body of the document.",
    },
  },

  // Title with no front matter
  {
    input: `# Another Note

This document has no front matter, just content.`,
    expected: {
      title: "Another Note",
      frontMatter: {},
      body: "This document has no front matter, just content.",
    },
  },

  // Title with front matter missing values
  {
    input: `# Empty Values
    
Created By:
Last Edited:
tags:
createdAt:
published:

Content for this note goes here.`,
    expected: {
      title: "Empty Values",
      frontMatter: {
        "Created By": null,
        "Last Edited": null,
        // Currently, empty values for these are removed to avoid confusion
        // updatedAt: null,
        // createdAt: null,
        // Important: emptry tags should be an empty array, not null or "" or [""]
        tags: [],
        published: "",
      },
      body: "Content for this note goes here.",
    },
  },

  // No front-matter, colon in the body
  {
    input: `# Notion title + colon in body

Body content has a colon: in it!`,
    expected: {
      title: "Notion title + colon in body",
      frontMatter: {},
      body: "Body content has a colon: in it!",
    },
  },

  // Frontmatter, colon in the body
  {
    input: `# Notion title + front matter + colon in body
    
Created By: John Doe
Last Edited: July 20, 2023 12:00 PM
Category: personal
createdAt: January 1, 2021
published: Yes

Body content has a colon: in it!`,
    expected: {
      title: "Notion title + front matter + colon in body",
      frontMatter: {
        "Created By": "John Doe",
        updatedAt: "2023-07-20T19:00:00.000Z",
        Category: "personal",
        createdAt: "2021-01-01T08:00:00.000Z",
        published: "Yes",
      },
      body: "Body content has a colon: in it!",
    },
  },

  // Frontmatter, no body. I have many of these in my notes.
  {
    input: `# Notion title + front matter + no body
    
Created By: John Doe
Last Edited: July 20, 2023 12:00 PM
Category: personal
createdAt: January 1, 2021
published: Yes`,
    expected: {
      title: "Notion title + front matter + no body",
      frontMatter: {
        "Created By": "John Doe",
        updatedAt: "2023-07-20T19:00:00.000Z",
        Category: "personal",
        createdAt: "2021-01-01T08:00:00.000Z",
        published: "Yes",
      },
      body: "",
    },
  },
  // Notion Edge Case: No title, but front matter with special characters
  //   {
  //     input: `Created By: Jane Doe
  // Last Edited: July 20, 2023 12:00 PM
  // Category: "work, personal"
  // createdAt: January 1, 2021 8:30 AM
  // published: No

  // Body starts here and has no title.`,
  //     expected: {
  //       title: "",
  //       frontMatter: {
  //         "Created By": "Jane Doe",
  //         "Last Edited": "July 20, 2023 12:00 PM",
  //         Category: "work, personal",
  //         createdAt: "January 1, 2021 8:30 AM",
  //         published: "No",
  //       },
  //       body: "Body starts here and has no title.",
  //     },
  //   },

  // Case 5: Title with multi-line front matter
  // Nah. https://github.com/cloverich/chronicles/issues/256
  //   {
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

  // Case 6: YAML-style front matter with tags; no space after last line of
  // front matter (but has correct ---)
  //   {
  //     input: `---
  // title: "YAML Note"
  // tags: work, personal
  // createdAt: 2023-09-28
  // updatedAt: 2023-09-29
  // ---
  // This is a document with YAML front matter.`,
  //     expected: {
  //       title: "",
  //       frontMatter: {
  //         title: "YAML Note",
  //         tags: ["work", "personal"],
  //         createdAt: "2023-09-28",
  //         updatedAt: "2023-09-29",
  //       },
  //       body: "This is a document with YAML front matter.",
  //     },
  //   },

  // Case 7: YAML front matter without tags
  //   {
  //     input: `---
  // title: "Note Without Tags"
  // createdAt: 2023-09-28
  // ---
  // Just some plain content.`,
  //     expected: {
  //       title: "",
  //       frontMatter: {
  //         title: "Note Without Tags",
  //         createdAt: "2023-09-28",
  //       },
  //       body: "Just some plain content.",
  //     },
  //   },

  // Case 8: No front matter or title, only body
  // {
  //   input: `This document only has body content.`,
  //   expected: {
  //     title: "",
  //     frontMatter: {},
  //     body: "This document only has body content.",
  //   },
  // },

  // Case 9: Front matter with a multi-line description field
  // https://github.com/cloverich/chronicles/issues/256
  //   {
  //     input: `# Notes on Testing
  // Description: >
  //   This document explains
  //   the importance of testing
  //   in software development.

  // The body text starts here.`,
  //     expected: {
  //       title: "Notes on Testing",
  //       frontMatter: {
  //         Description:
  //           "This document explains the importance of testing in software development.",
  //       },
  //       body: "The body text starts here.",
  //     },
  //   },

  // Case 10: Mixed Notion-style front matter with YAML tags
  //   {
  //     input: `# Mixed Front Matter
  // Created By: John Doe
  // Last Edited: July 20, 2023
  // tags: work, projects

  // Body content follows after mixed front matter.`,
  //     expected: {
  //       title: "Mixed Front Matter",
  //       frontMatter: {
  //         "Created By": "John Doe",
  //         "Last Edited": "July 20, 2023",
  //         tags: ["work", "projects"],
  //       },
  //       body: "Body content follows after mixed front matter.",
  //     },
  //   },
];

// todo: Test with colons in the body, ensure it STOPS trying tp parse front matter
// after the final newline; either that or pre-process the content to ...

//
export const inferOrGenerateJournalNameTestCases = [
  // base case
  {
    input: "Documents c3ceaee48e24410f90a075fb72681991",
    output: "Documents c3ceaee48e24410f90a075fb72681991",
  },
  // base case (nested)
  {
    input:
      "Documents c3ceaee48e24410f90a075fb72681991/Attachments c3ceaee48e24410f90a075fb72681991",
    output: "Documents_Attachments",
  },
  // probably works fine but shrug
  {
    input: "Documents",
    output: "Documents",
  },
  // reserved name results in generated folder name
  {
    input: "_attachments",
    // uuidv7 regex completely untested / unused just an idea
    // because _attachments is not allowed, should be generated
    output: /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/g,
  },
  {
    input: "TODO_MAKE_THIS_A_TOO_LONG_INVALID_NAME_BLAHBLAHBLAH",
    output: "TODO_...", // shorter
  },
];

describe("Frontmatter parsing", () => {
  it("this does not break?", () => {
    const parsed = parseTitleAndFrontMatterForImport(
      dedent(
        `---
title: What chronicles was
tags:
  - tags, thesixthprototype
createdAt: 2024-06-30T14:19:17.801Z
updatedAt: 2024-07-02T04:52:50.639Z
---`,
      ),
      "",
      SourceType.Other,
    );
  });

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

  it("tags or wikilinks in content, when importing from default source", () => {
    const parsed = parseTitleAndFrontMatterForImport(
      dedent(`---
        title: What chronicles was
        ---

        This is some content with a #tag and a [[wikilink]].`),
      "",
      SourceType.Other,
    );

    // actually testing ^ does not throw, because it re-serializes the body without
    // the front matter, and was choking when the wrong parser was used, which parsed
    // ofmTags but could not re-serialize them at this step.
    expect(parsed.frontMatter.title).to.equal("What chronicles was");
  });

  it.only("empty contents -> default front matter / no error", () => {
    const parsed = parseTitleAndFrontMatterForImport("", "", SourceType.Other);
    expect(parsed.body).to.equal("");
    expect(parsed.frontMatter).to.deep.equal({
      title: "",
      tags: [],
    });
  });
});
