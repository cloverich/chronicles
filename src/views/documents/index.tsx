import React, { useEffect, useContext, useState } from "react";
import useClient from "../../hooks/useClient";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph, Pane } from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import TagSearch from "./search";

import { SearchV2Store } from "./SearchStore";
import { DocumentItem } from "./DocumentItem";
import { RouteProps, useNavigate, Link } from 'react-router-dom';

interface Props extends RouteProps {
  store?: SearchV2Store;
  disableDocCreate?: boolean;
}

const Layout = observer(function LayoutNaked(props: Partial<Props>) {
  // conditionally show document create button.
  function createDocumentsView() {
    if (props.disableDocCreate) return;

    return (
      <>
        <Pane marginBottom={8}>
          <TagSearch store={props.store} />
        </Pane>
        <Pane>
          <Link to="/edit/new">
            Create new
          </Link>
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
  const navigate = useNavigate();

  function edit(docId: string) {
    navigate(`/edit/${docId}`)
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
        <Layout store={searchStore}>
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
    return <DocumentItem key={doc.id} doc={doc} getName={getName} edit={edit} />;
  });

  return (
    <Layout store={searchStore}>
      {docs}
    </Layout>
  );
}

export default observer(DocumentsContainer);
