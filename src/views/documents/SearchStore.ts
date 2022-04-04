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

  // copoied from JournalsUIStore
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
    return this.tokens
      .filter((t) => t.type === "in")
      .map((token) => this.journals.idForName(token.value as string))
      .filter((token) => token) as string[];
  };

  search = async () => {
    this.loading = true;
    this.error = null;

    const query: string[] = this.tokensToQuery();
    // Hmm -- need to get from journal name to id...
    // I guess take journals, find by name, convert to id
    try {
      const res = query.length
        ? this.client.documents.search({ journals: query })
        : this.client.documents.search();
      this.docs = (await res).data;
    } catch (err) {
      console.error("Error with documents.search results", err);
      this.error = err instanceof Error ? err.message : JSON.stringify(err);
    }

    this.loading = false;
  };
}
