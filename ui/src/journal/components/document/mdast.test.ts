import { suite, test } from "mocha";
import { assert } from "chai";
import { filterMdast } from "./mdast";
import { createLink, createParagraph, createText } from "ts-mdast";

suite("mdast.filterMdast", function () {
  test("empty tree");

  test("nodes with matching children", function () {
    const href = "https://pinecoder.dev";
    const title = "Learning to blog";

    // A tree with links, some top level
    // and some as nested children
    const tree = {
      type: "root" as "root",
      children: [
        createLink(href, title),
        createLink(href, title),
        createParagraph([createText("Some text"), createLink(href, title)]),
      ],
    };

    // Filter on link nodes
    const results = filterMdast(tree, { type: "link" });

    // Should get 3 back, and they should all be link nodes
    assert.lengthOf(results.children, 3);
    results.children.forEach((child) => {
      assert.equal(child.type, "link");
    });
  });
});
