import { suite, test } from "mocha";
import { assert } from "chai";
import { observable, IObservableArray } from "mobx";
import { TagSearchStore } from "../TagSearchStore";
import { SearchToken } from "./tokens";

interface TokensStore {
  tokens: IObservableArray<SearchToken>;
}

function makeMock(): [TokensStore, TagSearchStore] {
  const mockStore = observable({
    tokens: observable([]) as IObservableArray<SearchToken>,
  });

  return [mockStore, new TagSearchStore(mockStore)];
}

// todo: technically... since TagSearchStore.searchTokens computes from
// store.tokens... I _could_ re-write many of the parser tests to
// check the parsed token strings in searchTokens instead of
// store.tokens. Test's would be more readable...
// ... and also confirms the parse to token -> serialize to string works correctly.
// In UI testing, I found that adding `filter:code` serialized to `filter:undefined`
// A separate routine could confirm the tokens -> searchTokens
// reaction...
suite("TagSearchStore", function () {
  test("filter:", function () {
    const [mock, store] = makeMock();

    store.addToken("filter:code");

    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "filter",
      value: {
        type: "code",
        text: undefined,
      },
    });

    // should _replace_ first token
    store.addToken("filter:link");

    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "filter",
      value: {
        type: "link",
        text: undefined,
      },
    });

    // remove works
    store.removeToken("filter:link");
    assert.equal(mock.tokens.length, 0);
  });

  test("focus:", function () {
    const [mock, store] = makeMock();
    store.addToken("focus:todo list");
    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "focus",
      value: {
        type: "heading",
        content: "# todo list",
        depth: "h1",
      },
    });

    store.addToken("focus:## another token");

    // should replace
    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "focus",
      value: {
        type: "heading",
        // check for depth - 2
        content: "## another token",
        depth: "h2",
      },
    });

    // remove
    store.removeToken("focus:## another token");
    assert.equal(mock.tokens.length, 0);
  });

  test("in:", function () {
    const [mock, store] = makeMock();
    store.addToken("in:chronicles");
    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "in",
      value: "chronicles",
    });

    // Re-adding 
    store.addToken("in:chronicles");
    assert.equal(mock.tokens.length, 1, 'Adding the same text twice should produce only one token');

    // Remove a token that isn't there should not throw an error
    store.removeToken("in:random");
    assert.equal(mock.tokens.length, 1);

    // Removing a token
    store.removeToken("in:chronicles");
    assert.equal(mock.tokens.length, 0);

    // Adding multiple tokens
    store.addToken("in:chronicles");
    store.addToken("in:foobar the best");
    assert.equal(mock.tokens.length, 2);

    // todo: adding only valid journals
  });

  test("title:", function () {
    const [mock, store] = makeMock();
    store.addToken("title:foo bar");
    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "title",
      value: "foo bar",
    });

    store.addToken("title:foo bar");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("title:random");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("title:foo bar");
    assert.equal(mock.tokens.length, 0);
  })

  test("text:", function () {
    const [mock, store] = makeMock();
    store.addToken("text:foo bar");
    assert.equal(mock.tokens.length, 1);
    assert.deepEqual(mock.tokens[0], {
      type: "text",
      value: "foo bar",
    });

    store.addToken("text:foo bar");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("text:random");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("text:foo bar");
    assert.equal(mock.tokens.length, 0);
  })

  test("free text", function () {
    // todo: replicate text: tests
  })

  test("after:", function () {
    // todo: adding a new one replaces existing token

  });

  test("mix and match", function () {
    // add two journals
    // add filter
    // add focus, it clears filter
    // add filter, it clears focus (should it?)
    // remove filter, it leaves journals
  });
});
