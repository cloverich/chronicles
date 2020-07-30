import { suite, test } from "mocha";

suite("journals", function () {
  test("add invalid directory (does not exist)");
  test("add permissions error");
  test("add duplicate");
  test("add happy path");
  test("removing a journal (happy path");
  test("removing a journal (journal does not exist)");
});

suite("documents", function () {
  test("save existing document");
  test("save new document (regression bug happened previously)");
});

suite("startup", function () {
  test("opening background process");
  test("background process shuts down on close");
});
