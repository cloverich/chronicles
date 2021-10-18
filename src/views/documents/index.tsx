import React, { useEffect, useContext, useState } from "react";
import useClient, { Client, SearchResponse } from "../../hooks/useClient";
import { observable, IObservableArray, reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph, Pane, Button } from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalsStore } from "../../hooks/stores/journals";
import TagSearch from "./search";
import { SearchToken, JournalToken } from "./search/tokens";

class SearchV2Store {
  @observable docs: SearchResponse["data"] = [];
  @observable loading = true;
  @observable error: string | null = null;
  private journals: JournalsStore;

  // copoied from JournalsUIStore
  @observable tokens: IObservableArray<SearchToken> = observable([]);

  constructor(private client: Client, journals: JournalsStore) {
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

import { ViewState } from "../../container";

interface Props extends React.PropsWithChildren<{}> {
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  store?: SearchV2Store;
  disableDocCreate?: boolean;
}

const Layout = observer(function LayoutNaked(props: Partial<Props>) {
  // conditionally show document create button.
  function createDocumentsView() {
    if (!props.setView || props.disableDocCreate) return;

    return (
      <>
        <Pane marginBottom={8}>
          <TagSearch store={props.store} />
        </Pane>
        <Pane>
          <a onClick={() => props.setView!({ name: "edit", props: {} })}>
            Create new
          </a>
        </Pane>
      </>
    );
  }

  return (
    <Pane>
      {createDocumentsView()}

      <Pane marginTop={24}>{props.children}</Pane>
    </Pane>
  );
});

function DocumentsContainer(props: Props) {
  const journalsStore = useContext(JournalsStoreContext);
  const client = useClient();
  const [searchStore] = useState(new SearchV2Store(client, journalsStore));

  function edit(docId: string) {
    props.setView({ name: "edit", props: { documentId: docId } });
  }

  // execute search on mount
  useEffect(() => {
    searchStore.search();
  }, []);

  // loading states
  if (searchStore.loading && !searchStore.docs.length) {
    return (
      <Layout>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  // todo: I didn't really implement error handling :|
  if (searchStore.error) {
    return (
      <Layout>
        <Heading>Error</Heading>
        <Paragraph>{JSON.stringify(searchStore.error)}</Paragraph>
      </Layout>
    );
  }

  // empty states
  if (!searchStore.docs.length) {
    if (journalsStore.journals.length) {
      return (
        <Layout store={searchStore} setView={props.setView}>
          <Heading>No documents found</Heading>
          <Paragraph>Broaden your search, or add more documents.</Paragraph>
        </Layout>
      );
    } else {
      return (
        <Layout store={searchStore} disableDocCreate>
          <Heading>No journals added</Heading>
          <Paragraph>
            Use the preferences link in the navbar to create a new journal.
          </Paragraph>
        </Layout>
      );
    }
  }

  function getName(id: string) {
    const jrnl = journalsStore.journals?.find((j) => j.id === id);
    if (!jrnl) return "shrug";

    return jrnl.name;
  }

  // .slice(0, 100) until pagination and persistent search state are implemented
  const docs = searchStore.docs.slice(0, 100).map((doc) => {
    return (
      <Pane
        key={doc.id}
        style={{ display: "flex" }}
        onClick={() => edit(doc.id)}
      >
        <div style={{ marginRight: "24px" }}>{doc.createdAt.slice(0, 10)}</div>
        <div>
          /{getName(doc.journalId)}/{doc.title}
        </div>
      </Pane>
    );
  });

  return (
    <Layout setView={props.setView} store={searchStore}>
      {docs}
    </Layout>
  );
}

export default observer(DocumentsContainer);
