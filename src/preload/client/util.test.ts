import { assert } from "chai";
import { suite, test } from "mocha";
import { createId } from "./util";

suite("id generation", () => {
  test("it generates ids in order", () => {
    const ids = [createId(), createId(), createId()];

    assert.sameOrderedMembers(ids, ids.slice().sort());
  });

  test("it generates ids in order when timestamp provided", () => {
    const backwards = [
      createId(Date.parse("2024-01-01")),
      createId(Date.parse("2023-01-01")),
      createId(Date.parse("2022-01-01")),
    ];

    assert.sameOrderedMembers(
      backwards.slice().reverse(),
      backwards.slice().sort(),
    );
  });
});
