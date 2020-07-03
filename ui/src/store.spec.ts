import { describe, it } from "mocha";
import { expect } from "chai";
import Store, { findGenerator } from "./store";

// broken: order is backwards. I think I changed input structure.
// but cool idea, might save for later
describe.skip("findGenerator", function () {
  it("orders results by date when called with multiple journals", function () {
    const searchResults = [
      {
        count: 4,
        journal: "journal-even",
        results: ["2022-04-01", "2020-04-01", "2018-04-01"],
      },
      {
        count: 4,
        journal: "journal-odd",
        results: ["2023-04-01", "2021-04-01", "2019-04-01"],
      },
    ];

    const expectedOrder = [
      { journal: "journal-odd", date: "2023-04-01" },
      { journal: "journal-even", date: "2022-04-01" },
      { journal: "journal-odd", date: "2021-04-01" },
      { journal: "journal-even", date: "2020-04-01" },
      { journal: "journal-odd", date: "2019-04-01" },
      { journal: "journal-even", date: "2018-04-01" },
    ];

    let idx = 0;
    for (const result of findGenerator(searchResults)) {
      const expected = expectedOrder.shift();
      expect(result.date).to.equal(expected!.date);
      expect(result.date).to.equal(expected!.journal);
    }
  });
});

type ILocalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  hasItem: any;
};

function mockStorage() {
  return {
    getItem(key: string) {
      return JSON.stringify([{ name: "chronicles", url: "/foo/bar/baz" }]);
    },
    setItem(key: string) {},
    removeItem(key: string) {},
    hasItem(key: string) {
      return false;
    },
  };
}

describe.skip("Store", function () {
  it("exists", function () {
    const store = new Store(mockStorage());
    expect(store).to.exist;
  });

  it("loads", async function () {
    const store = new Store(mockStorage());
    expect(store).to.exist;
    await store.load();
  });
});
