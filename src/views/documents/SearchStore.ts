import { IClient } from "../../hooks/useClient";
import { observable, IObservableArray, reaction, computed, action } from "mobx";
import { JournalsStore } from "../../hooks/stores/journals";
import { SearchToken } from "./search/tokens";
import { TagSearchStore } from "./TagSearchStore";

export interface SearchItem {
  id: string;
  createdAt: string;
  title?: string;
  journalId: string;
}

export class SearchV2Store {
  @observable docs: SearchItem[] = [];
  @observable loading = true;
  @observable error: string | null = null;
  private journals: JournalsStore;
  private tagSeachStore: TagSearchStore;
  private setTokensUrl: any; // todo: This is react-router-dom's setUrl; type it

  @observable private _tokens: IObservableArray<SearchToken> = observable([]);

  constructor(private client: IClient, journals: JournalsStore, setTokensUrl: any) {
    this.journals = journals;
    this.tagSeachStore = new TagSearchStore(this);
    this.setTokensUrl = setTokensUrl;

    // Re-run the search query anytime the tokens change.
    reaction(() => this._tokens.slice(), this.search, {
      fireImmediately: false,
    });
  }

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
  }

  @computed get tokens(): IObservableArray<SearchToken> {
    return this._tokens;
  }

  // todo: this might be better as a @computed get
  private tokensToQuery = () => {
    const journals = this.tokens
      .filter((t) => t.type === "in")
      .map((token) => this.journals.idForName(token.value as string))
      .filter((token) => token) as string[];

    // todo: Typescript doesn't know when I filter to type === 'title' its TitleTokens
    // its confused by the nodeMatch type
    const titles = this.tokens.filter((t) => t.type === 'title').map(t => t.value) as any as string[]
    const texts = this.tokens.filter((t => t.type === 'text')).map(t => t.value) as any as string[]
    let before: string = '';

    const beforeToken = this.tokens.find(t => t.type === 'before');
    if (beforeToken) {
      before = beforeToken.value as string;
    }

    return { journals, titles, texts, before }
  };

  search = async () => {
    this.loading = true;
    this.error = null;

    const query = this.tokensToQuery();

    try {
      const res = this.client.documents.search(query);
      this.docs = (await res).data;
    } catch (err) {
      console.error("Error with documents.search results", err);
      this.error = err instanceof Error ? err.message : JSON.stringify(err);
    }

    this.loading = false;
  };

  // TODO: I refactored SearchStore to wrap TagSearchStore after some design issues;
  // do a full refactor pass after the key search features are working.
  addTokens = (searchStr: string[]) => {
    this.tagSeachStore.addTokens(searchStr);
  }

  addToken = (searchStr: string) => {
    this.tagSeachStore.addToken(searchStr);
    this.setTokensUrl({ search: this.searchTokens }, { replace: true });
  }

  removeToken = (token: string) => {
    this.tagSeachStore.removeToken(token);
    this.setTokensUrl({ search: this.searchTokens }, { replace: true });
  }

  @computed
  get searchTokens() {
    return this.tagSeachStore.searchTokens;
  }
}
