import { suite, test } from "mocha";

suite("creating the first journal", function () {
  test("empty state -- first boot, no journals");
  test("adding first journal");
  test("adding first document to empty journal");
  test("removing only document in only journal");
  test("removing first (only) journal");
});

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

suite("editing", function () {
  test("opening editor defaults to currently selected journal");
  test("editor pre-populates with selected dates content");
  test("document can be edited and saved");
  test("adding a new document updates the search");
});

suite("journal periods", function () {
  test(
    "indexing a journal by week, month, year only loads entries that match start of segment"
  );
  test("(API) adding an entry with wrong period fails");
  test("(UI) clicking 'new' defaults to the start of the journals period");
  test("(UI:hooks) getTodaysDate works, maybe same thing as above");
});

suite("search", function () {
  test("empty search results displays empty helper text");
});

suite("search api", function () {
  test("searching by journal");
  test("searching by multiple journals");
  test("searching all journals");
  test("searching with nodeQuery"); // by text, type, attributes
});
