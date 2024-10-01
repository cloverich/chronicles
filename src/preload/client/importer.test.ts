export const testCases = [
  // Case 1: Title and simple front matter with no special characters
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
        CreatedBy: "John Doe",
        LastEdited: "July 20, 2023 12:00 PM",
        Category: "personal",
        createdAt: "January 1, 2021",
        published: "Yes",
      },
      body: "This is the body of the document.",
    },
  },

  // Case 2: Title with no front matter
  {
    input: `# Another Note

This document has no front matter, just content.`,
    expected: {
      title: "Another Note",
      frontMatter: {},
      body: "This document has no front matter, just content.",
    },
  },

  // Case 3: No title, but front matter with special characters
  {
    input: `Created By: Jane Doe
Last Edited: July 20, 2023 12:00 PM
Category: "work, personal"
createdAt: January 1, 2021 8:30 AM
published: No

Body starts here and has no title.`,
    expected: {
      title: "",
      frontMatter: {
        CreatedBy: "Jane Doe",
        LastEdited: "July 20, 2023 12:00 PM",
        Category: "work, personal",
        createdAt: "January 1, 2021 8:30 AM",
        published: "No",
      },
      body: "Body starts here and has no title.",
    },
  },

  // Case 4: Title with front matter missing values
  {
    input: `# Empty Values
Created By:
Last Edited:
Category: work
createdAt:
published:

Content for this note goes here.`,
    expected: {
      title: "Empty Values",
      frontMatter: {
        CreatedBy: "",
        LastEdited: "",
        Category: "work",
        createdAt: "",
        published: "",
      },
      body: "Content for this note goes here.",
    },
  },

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
  //         CreatedBy: "Chris O",
  //         LastEdited: "July 25, 2023 9:45 PM",
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
  {
    input: `---
title: "YAML Note"
tags: work, personal
createdAt: 2023-09-28
updatedAt: 2023-09-29
---
This is a document with YAML front matter.`,
    expected: {
      title: "",
      frontMatter: {
        title: "YAML Note",
        tags: ["work", "personal"],
        createdAt: "2023-09-28",
        updatedAt: "2023-09-29",
      },
      body: "This is a document with YAML front matter.",
    },
  },

  // Case 7: YAML front matter without tags
  {
    input: `---
title: "Note Without Tags"
createdAt: 2023-09-28
---
Just some plain content.`,
    expected: {
      title: "",
      frontMatter: {
        title: "Note Without Tags",
        createdAt: "2023-09-28",
      },
      body: "Just some plain content.",
    },
  },

  // Case 8: No front matter or title, only body
  {
    input: `This document only has body content.`,
    expected: {
      title: "",
      frontMatter: {},
      body: "This document only has body content.",
    },
  },

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
  {
    input: `# Mixed Front Matter
Created By: John Doe
Last Edited: July 20, 2023
tags: work, projects

Body content follows after mixed front matter.`,
    expected: {
      title: "Mixed Front Matter",
      frontMatter: {
        CreatedBy: "John Doe",
        LastEdited: "July 20, 2023",
        tags: ["work", "projects"],
      },
      body: "Body content follows after mixed front matter.",
    },
  },

  // Case 11: No front-matter, colon in the body
  {
    input: `# Notion title + colon in body

Body content has a colon: in it!`,
    expected: {
      title: "Notion title + colon in body",
      frontMatter: {},
      body: "Body content has a colon: in it!",
    },
  },

  // Case 12: No front-matter, colon in the body
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
        CreatedBy: "John Doe",
        LastEdited: "July 20, 2023 12:00 PM",
        Category: "personal",
        createdAt: "January 1, 2021",
        published: "Yes",
      },
      body: "Body content has a colon: in it!",
    },
  },
];

// todo: Test with colons in the body, ensure it STOPS trying tp parse front matter
// after the final newline; either that or pre-process the content to ...
