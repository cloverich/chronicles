import { runInAction } from "mobx";
import assert from "node:assert";
import { describe, test } from "node:test";
import { TagStore } from "./TagStore";

describe("TagStore", () => {
  let store: TagStore;
  const initialOptions = [
    { value: "apple", label: "Fruit" },
    { value: "banana", label: "Fruit" },
    { value: "orange", label: "Fruit" },
    { value: "carrot", label: "Vegetable" },
  ];

  const selectedOptions: string[] = [];

  test("query filters options correctly", () => {
    store = new TagStore(initialOptions, false, selectedOptions, 0);

    runInAction(() => {
      store.query = "app";
    });
    assert.strictEqual(
      store.filteredOptions.length,
      1,
      "Should filter to 1 option for 'app'",
    );
    assert.strictEqual(
      store.filteredOptions[0].value,
      "apple",
      "Should match 'apple'",
    );

    // Test no matching options
    runInAction(() => {
      store.query = "xyz";
    });
    assert.strictEqual(
      store.filteredOptions.length,
      0,
      "Should filter to 0 options for 'xyz'",
    );
  });

  test("arrow keys change focusedIdx and focusedOption", () => {
    store = new TagStore(initialOptions, false, selectedOptions, 0);
    runInAction(() => {
      store.query = "a"; // Filter to "apple", "banana", "orange", "carrot"
      store.isOpen = true;
    });

    assert.strictEqual(
      store.focusedIdx,
      0,
      "Focused index should be 0 initially",
    );
    assert.strictEqual(
      store.focusedOption?.value,
      "apple",
      "Focused option should be 'apple'",
    );

    // Arrow down
    store.handleArrowDown();
    assert.strictEqual(
      store.focusedIdx,
      1,
      "Focused index should be 1 after arrow down",
    );
    assert.strictEqual(
      store.focusedOption?.value,
      "banana",
      "Focused option should be 'banana'",
    );

    // Arrow up
    store.handleArrowUp();
    assert.strictEqual(
      store.focusedIdx,
      0,
      "Focused index should be 0 after arrow up",
    );
    assert.strictEqual(
      store.focusedOption?.value,
      "apple",
      "Focused option should be 'apple'",
    );

    // Loop around with arrow up
    store.handleArrowUp(); // Should go to the last item
    assert.strictEqual(
      store.focusedIdx,
      0,
      "Focused index should stay on first time after arrow up from 0",
    );

    assert.strictEqual(
      store.focusedOption?.value,
      "apple",
      "Focused option should be 'apple'",
    );
  });

  test("FocusedIdx resets when query or isOpen changes", () => {
    runInAction(() => {
      store.query = "a";
      store.isOpen = true;
    });

    store.handleArrowDown();
    assert.strictEqual(store.focusedIdx, 1, "focusedIdx should be 1");

    runInAction(() => {
      store.query = "ba"; // Change query
    });
    assert.strictEqual(
      store.focusedIdx,
      0,
      "focusedIdx should reset to 0 after query change",
    );

    runInAction(() => {
      store.isOpen = false; // Close dropdown
    });
    assert.strictEqual(
      store.focusedIdx,
      null,
      "focusedIdx should reset to null when dropdown closes",
    );
  });
});
