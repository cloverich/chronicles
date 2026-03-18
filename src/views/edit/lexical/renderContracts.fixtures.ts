export interface RenderContractExpectedLink {
  href: string;
  name: string;
  noteLink?: boolean;
}

export interface RenderContractFixture {
  disallowFormattedNodesInsideLinks?: boolean;
  expectedLinks: RenderContractExpectedLink[];
  expectedLinkCount?: number;
  expectedStrongTexts?: string[];
  expectedItalicTexts?: string[];
  expectedInlineCodeTexts?: string[];
  forbiddenTextFragments?: string[];
  id: string;
  markdown: string;
  requiredTextFragments?: string[];
  requiredHtmlFragments?: string[];
  requiredSelectors?: string[];
}

export const renderContractFixtures: RenderContractFixture[] = [
  {
    id: "plain-text-renders",
    markdown: "simple plain note text",
    expectedLinks: [],
    expectedLinkCount: 0,
    requiredTextFragments: ["simple plain note text"],
    requiredSelectors: ["p"],
  },
  {
    id: "bold-renders",
    markdown: "this has **bold** content",
    expectedLinks: [],
    expectedLinkCount: 0,
    expectedStrongTexts: ["bold"],
    requiredSelectors: ["p strong"],
  },
  {
    id: "italic-renders",
    markdown: "this has _italic_ content",
    expectedLinks: [],
    expectedLinkCount: 0,
    expectedItalicTexts: ["italic"],
    requiredSelectors: ["p em"],
  },
  {
    id: "inline-code-renders",
    markdown: "use `chronicles://` protocol",
    expectedLinks: [],
    expectedLinkCount: 0,
    expectedInlineCodeTexts: ["chronicles://"],
    requiredSelectors: ["p code"],
  },
  {
    id: "regular-http-link-renders",
    markdown: "Read [docs](https://example.com) now.",
    expectedLinks: [{ name: "docs", href: "https://example.com" }],
    expectedLinkCount: 1,
    forbiddenTextFragments: ["[docs](https://example.com)"],
    requiredHtmlFragments: ['href="https://example.com"'],
    requiredSelectors: ["p a"],
    requiredTextFragments: ["Read ", " now."],
  },
  {
    id: "quoted-http-link-normalizes-and-renders",
    markdown: 'Read [docs]("https://example.com") now.',
    expectedLinks: [{ name: "docs", href: "https://example.com" }],
    expectedLinkCount: 1,
    forbiddenTextFragments: ['[docs]("https://example.com")'],
    requiredHtmlFragments: ['href="https://example.com"'],
    requiredSelectors: ["p a"],
    requiredTextFragments: ["Read ", " now."],
  },
  {
    id: "chronicles-note-link-renders-custom-anchor",
    markdown:
      "[Behavioral Interview Prep](../research/01931c56fc2378079233d986767c519c.md)",
    expectedLinks: [
      {
        name: "Behavioral Interview Prep",
        href: "../research/01931c56fc2378079233d986767c519c.md",
        noteLink: true,
      },
    ],
    expectedLinkCount: 1,
    requiredHtmlFragments: [
      'href="../research/01931c56fc2378079233d986767c519c.md"',
      'data-chronicles-note-link="true"',
    ],
    requiredSelectors: ["p a[data-chronicles-note-link='true']"],
  },
  {
    id: "mixed-real-note-structure-renders-semantic-blocks",
    markdown: [
      "# Daily Review",
      "",
      "- [Work at a Startup](https://www.workatastartup.com/companies)",
      "- follow up with recruiter",
      "",
      "> Keep this tight.",
    ].join("\n"),
    expectedLinks: [
      {
        name: "Work at a Startup",
        href: "https://www.workatastartup.com/companies",
      },
    ],
    expectedLinkCount: 1,
    requiredSelectors: ["h1", "ul li", "blockquote"],
  },
  {
    id: "combined-link-boundary-bold-boundary",
    markdown:
      "I'm [scared](https://news.ycombinator.com/item?id=47069650) I'll fuck up my **notes** while **vibe** coding this",
    expectedLinks: [
      {
        name: "scared",
        href: "https://news.ycombinator.com/item?id=47069650",
      },
    ],
    expectedLinkCount: 1,
    expectedStrongTexts: ["notes", "vibe"],
    disallowFormattedNodesInsideLinks: true,
    requiredTextFragments: [
      "I'm ",
      " I'll fuck up my ",
      " while ",
      " coding this",
    ],
    requiredSelectors: ["p a", "p strong"],
  },
  {
    id: "minimal-boundary-regular-link-before-note-link",
    markdown: "x [a](https://example.com) y [b](../bar/abc123.md)",
    expectedLinks: [
      { name: "a", href: "https://example.com" },
      { name: "b", href: "../bar/abc123.md", noteLink: true },
    ],
    expectedLinkCount: 2,
    disallowFormattedNodesInsideLinks: true,
    requiredTextFragments: ["x ", " y "],
    requiredSelectors: ["p a", "p a[data-chronicles-note-link='true']"],
  },
  {
    id: "user-sample-two-links-and-bold-boundaries",
    markdown: [
      "Damn, exciting times dude. I'm [scared](https://news.ycombinator.com/item?id=47069650) I'll fuck up my **notes** while **vibe** coding this thing into a better, more testable state. I hope I can last before I burn out, and before I break it. Definitely having to walk back some stuff.  [The title of this document could be anything, couldn't it. And then when we run out of space, what would happen next?](../bar/03e0ta3qio6i0f0o56ddcn57s.md)",
    ].join("\n"),
    expectedLinks: [
      {
        name: "scared",
        href: "https://news.ycombinator.com/item?id=47069650",
      },
      {
        name: "The title of this document could be anything, couldn't it. And then when we run out of space, what would happen next?",
        href: "../bar/03e0ta3qio6i0f0o56ddcn57s.md",
        noteLink: true,
      },
    ],
    expectedLinkCount: 2,
    expectedStrongTexts: ["notes", "vibe"],
    disallowFormattedNodesInsideLinks: true,
    requiredTextFragments: [
      "Damn, exciting times dude. I'm ",
      " I'll fuck up my ",
      " while ",
      " coding this thing into a better, more testable state.",
      " Definitely having to walk back some stuff.",
    ],
    requiredSelectors: [
      "p a",
      "p strong",
      "p a[data-chronicles-note-link='true']",
    ],
  },
];
