import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph, Pane } from "evergreen-ui";

import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { SearchStore, useSearchStore } from "./SearchStore";
import { DocumentItem } from "./DocumentItem";
import { useNavigate } from "react-router-dom";
import { Layout } from "./Layout";

function DocumentsContainer() {
  const journalsStore = useContext(JournalsStoreContext)!;
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

  function getName(id: string) {
    const jrnl = journalsStore.journals?.find((j) => j.id === id);
    if (!jrnl) return "shrug";

    return jrnl.name;
  }

  const docs = searchStore.docs.map((doc) => {
    return (
      <DocumentItem key={doc.id} doc={doc} getName={getName} edit={edit} />
    );
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
