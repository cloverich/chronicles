import { test } from "mocha";

test("when adding the first journal, the query reaction is setup");
test(
  "when removing a journal, if it was part of the current query that query is torn down"
);
test(
  "when removing the last journal, the query and content state are torn down"
); // same as above?
test("after initial load, the query watcher is setup");
test("after initial load, the default query is set and executed");
test("search is automatic when query changes");
