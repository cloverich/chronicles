import { assert } from "chai";
import { describe, test } from "node:test";
import { SearchParser } from "../SearchParser";
import { SearchToken } from "./tokens";

describe("SearchParser", function () {
  test("parseToken", function () {
    const parser = new SearchParser();
    const token = parser.parseToken("in:chronicles");

    assert.exists(token);
    assert.deepEqual(token, {
      type: "in",
      value: "chronicles",
    });
  });

  test("parseTokens", function () {
    const parser = new SearchParser();
    const tokens = parser.parseTokens([
      "in:chronicles",
      "text:javascript",
      "title:status update",
    ]);

    assert.equal(tokens.length, 3);
    assert.deepEqual(tokens, [
      {
        type: "in",
        value: "chronicles",
      },
      {
        type: "text",
        value: "javascript",
      },
      {
        type: "title",
        value: "status update",
      },
    ]);
  });

  test("mergeToken", function () {
    const parser = new SearchParser();
    const tokens = parser.parseTokens([
      "in:chronicles",
      "text:javascript",
      "title:status update",
    ]);

    const newToken = parser.parseToken("in:work");
    const mergedTokens = parser.mergeToken(tokens, newToken as SearchToken);
    assert.equal(mergedTokens.length, 4);
  });

  test("removeToken", function () {
    const parser = new SearchParser();
    const tokens = parser.parseTokens([
      "in:chronicles",
      "text:javascript",
      "title:status update",
    ]);

    const newToken = parser.parseToken("in:work");
    const mergedTokens = parser.mergeToken(tokens, newToken as SearchToken);
    assert.equal(mergedTokens.length, 4);

    const removedTokens = parser.removeToken(mergedTokens, "in:work");
    assert.equal(removedTokens.length, 3);
    assert.deepEqual(tokens, [
      {
        type: "in",
        value: "chronicles",
      },
      {
        type: "text",
        value: "javascript",
      },
      {
        type: "title",
        value: "status update",
      },
    ]);
  });

  describe("Parsers", function () {
    test("in:", function () {
      assert.equal(true, true);
      const pasrer = new SearchParser();
      const inChroniclesToken = pasrer.parseToken("in:chronicles");
      const inChroniclesToken2 = pasrer.parseToken("in:chronicles");

      assert.exists(inChroniclesToken);
      assert.exists(inChroniclesToken2);

      const tokens = pasrer.mergeToken(
        [inChroniclesToken as SearchToken],
        inChroniclesToken2 as SearchToken,
      );

      // shoulud drop the duplicate in: token
      assert.equal(tokens.length, 1);
      assert.deepEqual(tokens[0], {
        type: "in",
        value: "chronicles",
      });
    });

    test("in: with negation", function () {
      const parser = new SearchParser();
      const negativeJournalToken = parser.parseToken("-in:work");

      assert.exists(negativeJournalToken);
      assert.deepEqual(negativeJournalToken, {
        type: "in",
        value: "work",
        excluded: true,
      });

      const serialized = parser.serializeToken(
        negativeJournalToken as SearchToken,
      );
      assert.equal(serialized, "-in:work");
    });

    test("mergeToken (in) with negation", function () {
      const parser = new SearchParser();
      const tokens = parser.parseTokens(["in:personal"]);

      const negativeJournalToken = parser.parseToken("-in:work");
      const mergedTokens = parser.mergeToken(
        tokens,
        negativeJournalToken as SearchToken,
      );
      assert.equal(mergedTokens.length, 2);
      assert.deepEqual(mergedTokens, [
        { type: "in", value: "personal" },
        { type: "in", value: "work", excluded: true },
      ]);
    });

    test("tag:", function () {
      const pasrer = new SearchParser();
      const tagToken = pasrer.parseToken("tag:javascript");

      assert.exists(tagToken);
      assert.deepEqual(tagToken, {
        type: "tag",
        value: "javascript",
      });
    });

    test("tag: with #", function () {
      const pasrer = new SearchParser();
      const tagToken = pasrer.parseToken("tag:#javascript");

      assert.exists(tagToken);
      assert.deepEqual(tagToken, {
        type: "tag",
        // should remove the leading #
        value: "javascript",
      });
    });

    test("title:", function () {
      const pasrer = new SearchParser();
      const titleToken = pasrer.parseToken("title:fix testing, sigh esm?");

      assert.exists(titleToken);
      assert.deepEqual(titleToken, {
        type: "title",
        value: "fix testing, sigh esm?",
      });
    });

    test("text:", function () {
      const pasrer = new SearchParser();
      const textToken = pasrer.parseToken("text:my favorite restaurant");

      assert.exists(textToken);
      assert.deepEqual(textToken, {
        type: "text",
        value: "my favorite restaurant",
      });
    });

    test("before:", function () {
      const pasrer = new SearchParser();
      const beforeToken = pasrer.parseToken("before:2022-01-01");

      assert.exists(beforeToken);
      assert.deepEqual(beforeToken, {
        type: "before",
        value: "2022-01-01",
      });

      const beforeToken2 = pasrer.parseToken("before:2022-01-03");
      const tokens = pasrer.mergeToken(
        [beforeToken as SearchToken],
        beforeToken2 as SearchToken,
      );

      // the second before: token should replace the first
      assert.equal(tokens.length, 1);
      assert.deepEqual(tokens[0], {
        type: "before",
        value: "2022-01-03",
      });
    });

    test("date: with year", function () {
      const parser = new SearchParser();
      const dateToken = parser.parseToken("date:2025");

      assert.exists(dateToken);
      assert.deepEqual(dateToken, {
        type: "date",
        value: "2025",
      });
    });

    test("date: with year-month", function () {
      const parser = new SearchParser();
      const dateToken = parser.parseToken("date:2025-02");

      assert.exists(dateToken);
      assert.deepEqual(dateToken, {
        type: "date",
        value: "2025-02",
      });
    });

    test("date: with full date", function () {
      const parser = new SearchParser();
      const dateToken = parser.parseToken("date:2025-02-05");

      assert.exists(dateToken);
      assert.deepEqual(dateToken, {
        type: "date",
        value: "2025-02-05",
      });
    });

    test("date: invalid format", function () {
      const parser = new SearchParser();
      const dateToken = parser.parseToken("date:invalid");

      assert.notExists(dateToken, "Invalid date format should return undefined");
    });

    test("date: replacement", function () {
      const parser = new SearchParser();
      const dateToken1 = parser.parseToken("date:2025");
      const dateToken2 = parser.parseToken("date:2025-02");

      const tokens = parser.mergeToken(
        [dateToken1 as SearchToken],
        dateToken2 as SearchToken,
      );

      // the second date: token should replace the first
      assert.equal(tokens.length, 1);
      assert.deepEqual(tokens[0], {
        type: "date",
        value: "2025-02",
      });
    });

    test("tag: with negation", function () {
      const parser = new SearchParser();
      const negativeTagToken = parser.parseToken("-tag:javascript");

      assert.exists(negativeTagToken);
      assert.deepEqual(negativeTagToken, {
        type: "tag",
        value: "javascript",
        excluded: true,
      });

      const serialized = parser.serializeToken(negativeTagToken as SearchToken);
      assert.equal(serialized, "-tag:javascript");
    });

    test("mergeToken with negation", function () {
      const parser = new SearchParser();
      const tokens = parser.parseTokens(["tag:alpha"]);

      const negativeTagToken = parser.parseToken("-tag:alpha");
      const mergedTokens = parser.mergeToken(
        tokens,
        negativeTagToken as SearchToken,
      );
      assert.equal(
        mergedTokens.length,
        2,
        "Should allow both included and excluded tags for the same value",
      );
      assert.deepEqual(mergedTokens, [
        { type: "tag", value: "alpha" },
        { type: "tag", value: "alpha", excluded: true },
      ]);
    });

    test("removeToken with negation", function () {
      const parser = new SearchParser();
      const tokens = [
        { type: "tag", value: "alpha" },
        { type: "tag", value: "beta", excluded: true },
        { type: "tag", value: "gamma" },
      ] as SearchToken[];

      const removedTokens = parser.removeToken(tokens, "-tag:beta");
      assert.equal(removedTokens.length, 2);
      assert.deepEqual(removedTokens, [
        { type: "tag", value: "alpha" },
        { type: "tag", value: "gamma" },
      ]);

      const notRemovedTokens = parser.removeToken(tokens, "tag:beta");
      assert.equal(
        notRemovedTokens.length,
        3,
        "Should not remove included tag if excluded was specified",
      );
    });
  });
});

// NOTE: filter: and focus: are no longer valid, but I intend to re-implement them at some point;
// saving prior tests for reference (or clean-up later)
//   test("filter:", function () {
//     const [mock, store] = makeMock();

//     store.addToken("filter:code");

//     assert.equal(mock.tokens.length, 1);
//     assert.deepEqual(mock.tokens[0], {
//       type: "filter",
//       value: {
//         type: "code",
//         text: undefined,
//       },
//     });

//     // should _replace_ first token
//     store.addToken("filter:link");

//     assert.equal(mock.tokens.length, 1);
//     assert.deepEqual(mock.tokens[0], {
//       type: "filter",
//       value: {
//         type: "link",
//         text: undefined,
//       },
//     });

//     // remove works
//     store.removeToken("filter:link");
//     assert.equal(mock.tokens.length, 0);
//   });

//   test("focus:", function () {
//     const [mock, store] = makeMock();
//     store.addToken("focus:todo list");
//     assert.equal(mock.tokens.length, 1);
//     assert.deepEqual(mock.tokens[0], {
//       type: "focus",
//       value: {
//         type: "heading",
//         content: "# todo list",
//         depth: "h1",
//       },
//     });

//     store.addToken("focus:## another token");

//     // should replace
//     assert.equal(mock.tokens.length, 1);
//     assert.deepEqual(mock.tokens[0], {
//       type: "focus",
//       value: {
//         type: "heading",
//         // check for depth - 2
//         content: "## another token",
//         depth: "h2",
//       },
//     });

//     // remove
//     store.removeToken("focus:## another token");
//     assert.equal(mock.tokens.length, 0);
//   });
