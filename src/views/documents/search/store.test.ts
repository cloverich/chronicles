import { suite, test } from "mocha";
import { assert } from "chai";
import { observable, IObservableArray } from "mobx";
import { TagSearchStore } from "./store";
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
// In UI testing, I found taht adding `filter:code` serialized to `filter:undefined`
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

    store.addToken("in:chronicles");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("in:random");
    assert.equal(mock.tokens.length, 1);

    store.removeToken("in:chronicles");
    assert.equal(mock.tokens.length, 0);

    store.addToken("in:chronicles");
    store.addToken("in:foobar the best");
    assert.equal(mock.tokens.length, 2);

    // FUCK: How will this work?
    // Could pass valid journals to the store,
    // or operate through a setter
    // adding a fake one does nothing
    // removing a fake one does nothing
    // remove last one
  });

  test("mix and match", function () {
    // add two journals
    // add filter
    // add focus, it clears filter
    // add filter, it clears focus (should it?)
    // remove filter, it leaves journals
  });
});
