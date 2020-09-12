import { Root } from "mdast";
import { toJS } from "mobx";
// import toString from "mdast-util-to-string";
// import unified from "unified";

// import remarkStringify, { RemarkStringifyOptions } from "remark-stringify";

// // todo: This is copy pasta from api/markdown
// const stringifier = unified().use(remarkStringify, {
//   commonmark: true,
//   gfm: true,
// })

import { stringifier } from "../../markdown/index";

interface Filter {
  content: string;
  depth: string; // 'h1' | 'h2' | ...
}

export function filtermdast(root: Root, heading: Filter) {
  // Once we've found our heading, begin collecting nodes
  // Do so until we hit anotther heading of equal or greater value
  // Track both concepts as "activeDepth", a right shit name.
  // TODO: Undig this pile of shit.
  let activeDepth = 0;

  // Replace original root node with a copy...
  let newroot = {
    ...root,
    // ... that thas fewer children -- just those under the focused
    // heading...
    children: [] as any[],
  };

  for (const child of root.children) {
    if (child.type === "heading") {
      // if new heading is >= this heading, stop collecting
      if (activeDepth && activeDepth >= child.depth) {
        activeDepth = 0;

        // If not yet collecting, should we start?
      } else if (stringifier.stringify(child) === heading.content) {
        activeDepth = child.depth;
        // Don't add the matching heading, just the content under it
        continue;
      }
    }

    // append if we are collecting
    if (activeDepth) {
      newroot.children.push(child);
    } else {
    }
  }

  return newroot;
}

export function annotateHeadings(root: Root) {
  for (const child of root.children) {
    if (child.type === "heading") {
      if (!child.data) child.data = {};
      child.data.hProperties = {
        remarkString: stringifier.stringify(toJS(child)), // toJS here fixes a read out of bounds mobx error but not the infinite loops
      };
    }
  }
}
