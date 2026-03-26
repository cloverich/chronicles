# Lexical Editor QA

TODO: expand this as more of the migration completes.

**Related docs:** [Design doc](../designs/lexical-evaluation.md) | [Editor doc](../editor/lexical.md)

---

## Scrollbar

- Open a long note. Scroll up and down. The editor width should not shift/bounce as the scrollbar appears or disappears.

## Element spacing

- Headings, paragraphs, lists, blockquotes, and code blocks should have consistent vertical spacing — comparable to the Plate editor.

## Note link dropdown

- Type `[[` or the note-link trigger to open the dropdown.
- Typing filters the list by title.
- The current note does **not** appear in the results.
- Selecting an entry inserts a well-formed note link.
