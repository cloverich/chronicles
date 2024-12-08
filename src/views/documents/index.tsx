import { Heading, Pane, Paragraph } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";

import { useNavigate } from "react-router-dom";
import { useJournals } from "../../hooks/useJournals";
import { DocumentItem } from "./DocumentItem";
import { Layout } from "./Layout";
import { SearchStore, useSearchStore } from "./SearchStore";

function DocumentsContainer() {
  const journalsStore = useJournals();
  const searchStore = useSearchStore()!;
  const navigate = useNavigate();

  function edit(docId: string) {
    navigate(`/documents/edit/${docId}`);
  }

  // loading states
  if (searchStore.loading && !searchStore.docs.length) {
    return (
      <Layout store={searchStore} empty>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  // todo: Improve error handling
  // test case: can re-attempt search when searchStore has error (works)
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
        <Layout store={searchStore} empty>
          <Heading>No journals added</Heading>
          <Paragraph>
            Use the preferences link in the navbar to create a new journal.
          </Paragraph>
        </Layout>
      );
    }
  }

  const docs = searchStore.docs.map((doc) => {
    return <DocumentItem key={doc.id} doc={doc} edit={edit} />;
  });

  return (
    <Layout store={searchStore}>
      {docs}
      <Pagination store={searchStore} />
    </Layout>
  );
}

function Pagination(props: { store: SearchStore }) {
  const nextButton = (() => {
    if (props.store.hasNext) {
      return (
        <a
          style={{ marginLeft: "8px" }}
          href=""
          onClick={() => {
            props.store.next();
            window.scrollTo(0, 0);
            return false;
          }}
        >
          Next
        </a>
      );
    }
  })();

  const prevButton = (() => {
    if (props.store.hasPrev) {
      return (
        <a
          style={{ marginLeft: "8px" }}
          href=""
          onClick={() => {
            props.store.prev();
            window.scrollTo(0, 0);
            return false;
          }}
        >
          Prev
        </a>
      );
    }
  })();

  return (
    <Pane display="flex" justifyContent="flex-end" marginTop="24px">
      {prevButton}
      {nextButton}
    </Pane>
  );
}

export default observer(DocumentsContainer);
