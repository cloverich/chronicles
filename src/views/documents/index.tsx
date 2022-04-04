import React, { useEffect, useContext, useState } from "react";
import useClient from "../../hooks/useClient";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph, Pane } from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import TagSearch from "./search";

import { ViewState } from "../../container";
import { SearchV2Store } from "./SearchStore";
import { DocumentItem } from "./DocumentItem";

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
    return <DocumentItem doc={doc} getName={getName} edit={edit} />;
  });

  return (
    <Layout setView={props.setView} store={searchStore}>
      {docs}
    </Layout>
  );
}

export default observer(DocumentsContainer);
