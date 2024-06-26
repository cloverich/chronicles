import { test, suite } from "mocha";

suite("views.edit", function () {
  test("loads");
  test("has loading state");
  test("saves document");
  test("cannot edit while saving");
  test("saving a document twice updates it...");
  test("saving error is surfaced");
  test("loading error is surfaced");
});
