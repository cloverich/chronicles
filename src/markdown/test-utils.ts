import { Root } from "mdast";

import {
  parseMarkdownForImportProcessing as parseMarkdownForImportRaw,
  parseMarkdown as parseMarkdownRaw,
} from "./index.js";

// Remove the parsed position information to simplify deep equals comparisons
// There is a similar function that's an entire npm package; fuck that.
export function prunePositions(tree: any) {
  if (tree.position) {
    delete tree.position;
  }
  if (tree.children) {
    tree.children.forEach(prunePositions);
  }
  return tree;
}

// Easier to deep.equal() without position information
export const parseMarkdown = (markdown: string): Root =>
  prunePositions(parseMarkdownRaw(markdown));

export const parseMarkdownForImport = (markdown: string): Root =>
  prunePositions(parseMarkdownForImportRaw(markdown));

// Like _.get but fail loud, helpful error messages
// Usage: dig(mdast, 'children.0.children.1.value')
export function dig(obj: any, path: string) {
  const keys = path
    .split(".")
    .map((key) => (isNaN(Number(key)) ? key : Number(key)));

  return keys.reduce((acc, key, index) => {
    if (acc && key in acc) {
      return acc[key];
    } else {
      throw new Error(
        `Path error at step "${key}" (index ${index})\n` +
          `Full path: ${path}\n` +
          `Last good step object: ${JSON.stringify(acc, null, 2)}`,
      );
    }
  }, obj);
}

// Adapted from https://github.com/MartinKolarik/dedent-js
// Copyright (c) 2015 Martin Kolárik. Released under the MIT license.
export function dedent(
  templateStrings: TemplateStringsArray | string,
  ...values: any[]
) {
  let matches = [];
  let strings =
    typeof templateStrings === "string"
      ? [templateStrings]
      : templateStrings.slice();

  // 1. Remove trailing whitespace.
  strings[strings.length - 1] = strings[strings.length - 1].replace(
    /\r?\n([\t ]*)$/,
    "",
  );

  // 2. Find all line breaks to determine the highest common indentation level.
  for (let i = 0; i < strings.length; i++) {
    let match;

    if ((match = strings[i].match(/\n[\t ]+/g))) {
      matches.push(...match);
    }
  }

  // 3. Remove the common indentation from all strings.
  if (matches.length) {
    let size = Math.min(...matches.map((value) => value.length - 1));
    let pattern = new RegExp(`\n[\t ]{${size}}`, "g");

    for (let i = 0; i < strings.length; i++) {
      strings[i] = strings[i].replace(pattern, "\n");
    }
  }

  // 4. Remove leading whitespace.
  strings[0] = strings[0].replace(/^\r?\n/, "");

  // 5. Perform interpolation.
  let string = strings[0];

  for (let i = 0; i < values.length; i++) {
    string += values[i] + strings[i + 1];
  }

  return string;
}
