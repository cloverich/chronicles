import { createContext } from "react";
import { IClient } from "../../hooks/useClient";
import { observable, IObservableArray, computed, action } from "mobx";
import { JournalsStore } from "../../hooks/stores/journals";
import { SearchToken } from "./search/tokens";
import { SearchParser } from "./SearchParser";

export interface SearchItem {
  id: string;
  createdAt: string;
  title?: string;
  journalId: string;
}

interface SearchQuery {
  journals: string[];
  titles?: string[];
  before?: string;
  tags?: string[];
  texts?: string[];
  limit?: number;
}

export const SearchStoreContext = createContext<SearchStore>(null as any);

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
      const journal = this.journals.idForName(t.value as string);
      return !!journal;
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
      .map((token) => this.journals.idForName(token.value as string))
      .filter((token) => token) as string[];

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
   * Execute a search with the current tokens.
   *
   * @param resetPagination - By default execute a fresh search. When paginating,
   *  we don't want to reset the pagination state.
   */
  search = async (limit = 100, resetPagination = true) => {
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
      this.search(100, resetPagination);
    }
  };

  @action
  removeToken = (token: string, resetPagination = true) => {
    this.setTokens(this.parser.removeToken(this.tokens.slice(), token)); // slice() from prior implementation
    this.setTokensUrl({ search: this.searchTokens }, { replace: true });
    this.search(100, resetPagination);
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

  @computed get selectedJournals(): string[] {
    // Grab the journal names from the tokens
    // todo: Typescript doesn't know when I filter to type === 'in' its InTokens
    return this._tokens
      .filter((t) => t.type === "in")
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
