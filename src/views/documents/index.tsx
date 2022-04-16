import React, { useEffect, useContext, useState } from "react";
import useClient from "../../hooks/useClient";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph } from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";

import { SearchV2Store } from "./SearchStore";
import { DocumentItem } from "./DocumentItem";
import { useNavigate } from 'react-router-dom';
import { Layout, LayoutEmpty } from "./Layout";

function DocumentsContainer() {
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
      <LayoutEmpty>
        <Heading>Loading</Heading>
      </LayoutEmpty>
    );
  }

  // todo: Improve error handling
  // case: can re-attempt search when searchStore has error (works)
  if (searchStore.error) {
    return (
      <Layout store={searchStore}>
        <Heading>Error</Heading>
        <Paragraph>{JSON.stringify(searchStore.error)}</Paragraph>
      </Layout>
    );
  }

  // empty states
  // todo: maintain search input focus when result set is empty, currently
  // it loses focus
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
        <LayoutEmpty>
          <Heading>No journals added</Heading>
          <Paragraph>
            Use the preferences link in the navbar to create a new journal.
          </Paragraph>
        </LayoutEmpty>
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
