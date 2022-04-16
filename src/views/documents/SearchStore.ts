import { IClient } from "../../hooks/useClient";
import { observable, IObservableArray, reaction } from "mobx";
import { JournalsStore } from "../../hooks/stores/journals";
import { SearchToken } from "./search/tokens";

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

  @observable tokens: IObservableArray<SearchToken> = observable([]);

  constructor(private client: IClient, journals: JournalsStore) {
    this.journals = journals;

    // Re-run the search query anytime the tokens change.
    reaction(() => this.tokens.slice(), this.search, {
      fireImmediately: false,
    });
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
    return { journals, titles, texts }
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
}
