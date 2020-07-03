import API, { SearchResult, SaveDocRequest } from "./api";

interface DocResult {
  html: string;
  raw: string;
  date: string;
}

type ILocalStorage = Pick<
  typeof localStorage,
  "getItem" | "setItem" | "removeItem"
>;

class Store {
  searchResults: SearchResult[] = [];
  private storage: ILocalStorage;

  constructor(storage: ILocalStorage) {
    this.storage = storage;
  }

  load = async () => {
    const history = this.storage.getItem("journals");
    if (!history) return;
    try {
      console.log("history", history);
      const journals: string[] = JSON.parse(history);
      await Promise.all(journals.map((j) => this.addJournal(j)));
    } catch (err) {
      console.error(err);
      return;
    }
  };

  addJournal = async (journal: string) => {
    // did we already add it?
    if (this.searchResults.find((sr) => sr.journal === journal)) return;

    // add it
    await this.loadJournal(journal);
    const journals = this.getJournals();
    this.storage.setItem("journals", JSON.stringify(journals));
  };

  private loadJournal = async (journal: string) => {
    const sr = await API.search(journal);
    this.searchResults.push(sr);
  };

  private getJournals = () => {
    return this.searchResults.map((sr) => sr.journal);
  };

  deleteJournal = (journal: string) => {
    // Delete only reomves from ui
    this.searchResults = this.searchResults.filter(
      (sr) => sr.journal !== journal
    );
  };

  newDocument = (journal: string, content: string) => {
    // create a new note for today
    // if one already exists, open it?
    // If multi-journal search or saved search... ?
  };

  // Search takes a query and returns a search result set...
  // That result set is used to query for documents...
  search = async (limit: number): Promise<DocResult[]> => {
    // "/Users/cloverich/Google Drive/notes/chronicles"
    const documents: DocResult[] = [];
    let i = 0;
    for (const item of findGenerator(this.searchResults)) {
      documents.push(await API.fetchNote(item.journal, item.date));
      i++;

      if (i >= limit) break;
    }

    return documents;
  };

  saveDoc = async (doc: SaveDocRequest) => {
    // todo:
    await API.save(doc);
  };
}

export default Store;

class Document {
  static createNew() {}
  save(doc: DocumentForm) {}
  form() {}
}

class DocumentForm {
  // class or DTO?
}

// Search types and results
// To begin, make each search return the most recentt ten results only
// Single journal, regular
// Single journal, text search
// Single journal, structured search
// Multi journal, regular
// Multi journal, text search
// Multi journal, structured search

interface IQuery {
  journals: string[];
  text: string;
  structuredText: any; // todo
  filters: any; // todo
}

class Finder {
  search(q: IQuery) {
    // have journals
    q.journals;

    // step one: Stream journal responses
  }
}

// Knows how to search multiple journals and produce a single stream of results
interface Document {
  // Question: The UI wants to merge multiple documents from the same day right?
  // How to do this? Return multiple documents and let the UI layer display them together?
  // Or a single document?
  // Ultimately it has to be the latter because you cannot mix the UI... its always separated,
  // and its always edit in place _per journal_. Even if they are grouped...
  journal: string;
  date: string;
}

class JournalEntriesCache {
  private journals: SearchResult[] = [];

  /**
   * TODO: I need to make a generator but, for now, it would be
   * easier to simply merge each permutation of journals, and then
   * ... cache the results... and then each time a new entry is created
   * (for today, or historical)... update all the realted sets...
   * no thats too much work... just make the generator
   * @param journals
   */
  find(journals: string[]) {
    // Get which journals to search
    const toSearch = this.journals.filter((j) => journals.includes(j.journal));
    // Next items should include the date and journal
    let nextItems: Array<{ date: string; journal: string }> = [];

    // Pull the most recent date from each journal
    toSearch.forEach((journal) => {
      nextItems.push({ date: journal.results[0], journal: journal.journal });
    });

    // Find the max date from nextItems
    let max;
    // Yield?
    // Pop and replace...
  }
}

//  My first real
// hard problem surfaces :)
function findNextMin(arrs: ArraysToSearch): number {
  let min: string = "";
  let minIdx: number | null = null;
  arrs.forEach((ats, idx) => {
    const compare = ats.sr.results[ats.idx];
    console.log(compare, min, compare > min);
    if (!min || compare > min) {
      min = compare;
      minIdx = idx;
    }
  });

  if (minIdx === null) throw new Error("findNextMin was null");
  return minIdx;
}

type ArraysToSearch = Array<{ sr: SearchResult; idx: number }>;

/**
 * A good blog post in here...
 * My first real hard problem
 * Sorting two arays, sorting multiple arrays
 * Using a generator to support updating the UI before it is completed.
 *
 * How would this work in SQL?
 * Select, where journal, order by date or idx so you can paginate
 *
 * This is a deep subject that I need to learn more about.
 * @param journals
 */
export function* findGenerator(journals: SearchResult[]) {
  // Maintain a pointer for each array
  let arraysToSearch: ArraysToSearch = journals.map((sr) => ({ sr, idx: 0 }));

  // TODO: Now that it works refactor names
  while (arraysToSearch.length > 0) {
    // Find minimum
    const idxToPop = findNextMin(arraysToSearch);
    const arrayToPop = arraysToSearch[idxToPop];
    const idx = arrayToPop.idx;
    const items = arrayToPop.sr.results;
    const resultToYield = items[idx];

    yield { journal: arrayToPop.sr.journal, date: resultToYield };

    // increment
    arrayToPop.idx++;

    // If we've exhausted documents from this journal, remove it from
    // arraysToSearch
    if (arrayToPop.idx >= arrayToPop.sr.results.length) {
      arraysToSearch = arraysToSearch.filter((arr) => arr !== arrayToPop);
    }
  }
}
