import { IObservableArray, action, computed, observable } from "mobx";
import { createContext, useContext } from "react";
import { JournalsStore } from "../../hooks/stores/journals";
import { IClient } from "../../hooks/useClient";
import { SearchParser } from "./SearchParser";
import { SearchToken } from "./search/tokens";

export interface SearchItem {
  id: string;
  journal: string;
  createdAt: string;
  title?: string;
}

interface DocumentBase {
  id: string;
  journal: string;
  frontMatter: {
    createdAt: string;
    title?: string;
  };
}

// Accepts any document satisfying the SearchItem interface, and copies properties
// into an actual SearchItem; i.e. I dont want to stuff an EditableDocument or other smart
// object into search results b/c may get weird.
function toSearchItem(doc: DocumentBase): SearchItem | null {
  if (!doc.id) return null;

  return {
    id: doc.id,
    createdAt: doc.frontMatter.createdAt,
    title: doc.frontMatter.title,
    journal: doc.journal,
  };
}

interface SearchQuery {
  // journal name(s)
  journals: string[];
  titles?: string[];
  before?: string;
  tags?: string[];
  texts?: string[];
  limit?: number;
}

export const SearchStoreContext = createContext<SearchStore | null>(null);

export function useSearchStore() {
  const searchStore = useContext(SearchStoreContext);
  return searchStore;
}

export class SearchStore {
  @observable docs: SearchItem[] = [];
  @observable loading = true;
  @observable error: string | null = null;
  private journals: JournalsStore;
  private parser: SearchParser;
  // NOTE: Public so it can be updated by render calls, since useSearchParmas changes on
  // each render. Not ideal.
  setTokensUrl: any; // todo: This is react-router-dom's setUrl; type it

  @observable private _tokens: IObservableArray<SearchToken> = observable([]);

  constructor(
    private client: IClient,
    journals: JournalsStore,
    setTokensUrl: any,
    tokens: string[],
  ) {
    this.journals = journals;
    this.parser = new SearchParser();
    this.setTokensUrl = setTokensUrl;
    this.initTokens(tokens);
  }

  private initTokens = (searchStr: string[]) => {
    let tokens: SearchToken[] = [];
    for (const tokenStr of searchStr) {
      const token = this.parser.parseToken(tokenStr);
      if (!token) continue;

      if (token) {
        tokens = this.parser.mergeToken(tokens, token as SearchToken);
      }
    }

    this.setTokens(tokens);
    this.search();
  };

  /**
   * NOTE: This should be private, or refactored to trigger a search
   */
  @action
  setTokens = (tokens: SearchToken[]) => {
    // Filter out invalid in: journal tokens
    // Additional validation can go here as well
    tokens = tokens.filter((t) => {
      if (t.type !== "in") return true;
      if (!this.journals.journals.find((j) => j.name === t.value)) return false;
      return true;
    });

    this.tokens.replace(tokens);
  };

  @computed get tokens(): IObservableArray<SearchToken> {
    return this._tokens;
  }

  // todo: this might be better as a @computed get
  private tokensToQuery = (): SearchQuery => {
    const journals = this.tokens
      .filter((t) => t.type === "in")
      .map((token) => token.value) as string[]; // assumes pre-validated by addToeken above

    const tags = this.tokens
      .filter((t) => t.type === "tag")
      .map((t) => t.value) as string[];

    // todo: Typescript doesn't know when I filter to type === 'title' its TitleTokens
    // its confused by the nodeMatch type
    const titles = this.tokens
      .filter((t) => t.type === "title")
      .map((t) => t.value) as any as string[];
    const texts = this.tokens
      .filter((t) => t.type === "text")
      .map((t) => t.value) as any as string[];
    let before: string = "";

    const beforeToken = this.tokens.find((t) => t.type === "before");
    if (beforeToken) {
      before = beforeToken.value as string;
    }

    return { journals, tags, titles, texts, before };
  };

  /**
   * If a document is present in search results, and is edited / deleted / etc,
   * navigating back to the search without updating will result in stale results being shown.
   * This method updates the search results with the latest document data, IF its present
   * in the search results.
   */
  updateSearch = (
    document: DocumentBase,
    operation: "edit" | "create" | "del" = "edit",
  ) => {
    const idx = this.docs.findIndex((d) => d.id === document.id);
    const item = toSearchItem(document);
    if (!item) return; // shrug

    if (operation === "edit") {
      if (idx === -1) return;
      // NOTE: One weird case is, if the journal / tags change and don't match the search, it will
      // still be in the results (on back) but wont on refresh. Kind of an edge case that's not
      // a huge deal. See also create notes below
      this.docs[idx] = item;
    } else if (operation === "del") {
      if (idx === -1) return;
      this.docs.splice(idx, 1);
    } else if (operation === "create") {
      // NOTE: This assumes (usually correctly) that the created document's journal / tag will match
      // the current search results; if not it will not be shown. Maybe its reasonable? More of a weird
      // UX based on current design; its weird in others (e.g. Apple notes, when creating with a search filter)
      this.search({ resetPagination: true });
    }
  };

  /**
   * Execute a documents search with the current tokens.
   *
   * @param resetPagination - By default execute a fresh search. When paginating,
   *  we don't want to reset the pagination state.
   */
  search = async (opts: { limit?: number; resetPagination?: boolean } = {}) => {
    const limit = opts.limit || 100;
    const resetPagination = opts.resetPagination || true;

    this.loading = true;
    this.error = null;

    const q = this.tokensToQuery();

    // For determining if there is a next, add one to the limit
    // and see if we get it back.
    q.limit = limit + 1;

    try {
      const res = this.client.documents.search(q);
      const docs = (await res).data;

      if (docs.length > limit) {
        this.nextId = docs[docs.length - 1].id;
        docs.pop();
      } else {
        this.nextId = null;
      }

      if (resetPagination) {
        this.lastIds = [];
      }

      this.docs = docs;
    } catch (err) {
      console.error("Error with documents.search results", err);
      this.error = err instanceof Error ? err.message : JSON.stringify(err);
    }

    this.loading = false;
  };

  @action
  addToken = (searchStr: string, resetPagination = true) => {
    const token = this.parser.parseToken(searchStr);

    // todo: only search if the token string changes
    if (token) {
      this.setTokens(this.parser.mergeToken(this.tokens, token as SearchToken));
      this.setTokensUrl({ search: this.searchTokens }, { replace: true });
      this.search({ resetPagination });
    }
  };

  @action
  removeToken = (token: string, resetPagination = true) => {
    this.setTokens(this.parser.removeToken(this.tokens.slice(), token)); // slice() from prior implementation
    this.setTokensUrl({ search: this.searchTokens }, { replace: true });
    this.search({ resetPagination });
  };

  /**
   * Replace the current search with a new one.
   */
  @action
  setSearch = (searchStr: string[]) => {
    const lastSearch = this.searchTokens.sort().join(" ");
    const tokens = this.parser.parseTokens(searchStr);
    this.setTokens(tokens);

    const currentSearch = this.searchTokens.sort().join(" ");
    if (lastSearch !== currentSearch) {
      this.setTokensUrl({ search: this.searchTokens }, { replace: true });
      this.search();
    }
  };

  /**
   * Return the selected journals from the search tokens, if any
   */
  @computed get selectedJournals(): string[] {
    return (
      this._tokens
        .filter((t) => t.type === "in")
        // todo: Typescript doesn't know when I filter to type === 'in' its InTokens
        .map((t) => t.value) as string[]
    );
  }

  /**
   * Return the selected tags from the search tokens, if any
   */
  @computed get selectedTags(): string[] {
    return this._tokens
      .filter((t) => t.type === "tag")
      .map((t) => t.value) as string[];
  }

  @computed
  get searchTokens(): string[] {
    return this.tokens.map((token) => {
      return this.parser.serializeToken(token);
    });
  }

  // TODO:Test cases, sigh
  // When < limit, there is no next
  // When click next, next doc is correct, lastId works as expected
  // When next to last page, there is no next
  // When back to prior page, next and last id are correct
  // When back to first page, there is no last Id
  // New searches clear pagination data
  @observable nextId: string | null = null;
  @observable lastIds: (string | undefined)[] = [];
  @computed get hasNext() {
    return !!this.nextId;
  }
  @computed get hasPrev() {
    return !!this.lastIds.length;
  }

  @action
  next = () => {
    if (!this.nextId) return;

    const lastBefore = this._tokens.find((t) => t.type === "before")?.value;

    // This doesn't infer that lastBefore will be a token with a string value;
    // it thinks NodeMatch is possible here. Undefined indicates no prior page,
    // and logic above handles that.
    this.lastIds.push(lastBefore as string | undefined);
    this.addToken(`before:${this.nextId}`, false);
  };

  @action
  prev = () => {
    if (!this.hasPrev) return;

    const lastId = this.lastIds.pop();

    if (lastId) {
      this.addToken(`before:${lastId}`, false);
    } else {
      // Indicates this is the first next page, and clickign prev
      // takes us to the first page, i.e. no before: token
      const lastBefore = this._tokens.find((t) => t.type === "before");

      if (lastBefore) {
        this.removeToken(`before:${lastBefore.value}`, false);
      } else {
        // Didn't come up in testing, but this is a good sanity check
        console.error("Called prev but no before: token found?");
      }
    }
  };
}
