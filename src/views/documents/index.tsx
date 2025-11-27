import { observer } from "mobx-react-lite";
import React from "react";

import { useNavigate } from "react-router-dom";
import { Alert } from "../../components";
import { useJournals } from "../../hooks/useJournals";
import { usePreferences } from "../../hooks/usePreferences";
import { DocumentItem } from "./DocumentItem";
import { Layout } from "./Layout";
import { SearchStore, useSearchStore } from "./SearchStore";
import { groupDocumentsByDate } from "./search/groupDocumentsByDate";
import Welcome from "./welcome";

function DocumentsContainer() {
  const journalsStore = useJournals();
  const searchStore = useSearchStore()!;
  const navigate = useNavigate();
  const preferences = usePreferences();

  function edit(docId: string) {
    navigate(`/documents/edit/${docId}`);
  }

  // loading states
  if (
    (searchStore.loading || preferences.onboarding === "new") &&
    !searchStore.docs.length
  ) {
    return (
      <Layout store={searchStore} empty>
        <Alert.Alert
          variant="default"
          title="Loading documents"
          className="overflow-x-auto"
        >
          <p>...</p>
        </Alert.Alert>
      </Layout>
    );
  }

  if (preferences.onboarding === "new") {
    return (
      <Layout store={searchStore}>
        <Welcome onComplete={() => (preferences.onboarding = "complete")} />
      </Layout>
    );
  }

  // todo: Improve error handling
  // test case: can re-attempt search when searchStore has error (works)
  if (searchStore.error) {
    return (
      <Layout store={searchStore}>
        <Alert.Alert
          variant="error"
          title="Search failed"
          className="overflow-x-auto"
        >
          <p>Search failed: </p>
          <pre>{JSON.stringify(searchStore.error, null, 2)}</pre>
        </Alert.Alert>
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
          <Alert.Alert
            variant="default"
            title="No documents found"
            className="overflow-x-auto"
          >
            <p>Broaden your search, or add more notes.</p>
          </Alert.Alert>
        </Layout>
      );
    } else {
      return (
        <Layout store={searchStore} empty>
          <Alert.Alert
            variant="default"
            title="No journals added"
            className="overflow-x-auto"
          >
            <p>
              Use the preferences link in the navbar to create a new journal.
            </p>
          </Alert.Alert>
        </Layout>
      );
    }
  }

  const groupedDocs = groupDocumentsByDate(searchStore.docs);

  return (
    <Layout store={searchStore}>
      {groupedDocs.map((group) => (
        <div key={group.key} className="mb-8">
          <h2 className="mb-3 font-heading text-xl font-semibold text-accent-foreground">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.docs.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} edit={edit} />
            ))}
          </div>
        </div>
      ))}
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
    <div className="flex-end mt-6 flex">
      {prevButton}
      {nextButton}
    </div>
  );
}

export default observer(DocumentsContainer);
