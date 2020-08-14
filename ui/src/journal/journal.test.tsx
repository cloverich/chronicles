import { suite, test } from "mocha";

suite("header", function () {
  test("current journal can be selected from the dropdown");
  test(
    "add button creates a document for today in the currently selected journal"
  );
});
