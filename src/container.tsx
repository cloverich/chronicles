import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Layout from "./layout";
import Preferences from "./views/preferences";
import Journals from "./views/journals";
import Documents from "./views/documents";
import Editor from "./views/edit";
import {
  useJournalsLoader,
  JournalsStoreContext,
} from "./hooks/useJournalsLoader";
import { Alert, Pane } from "evergreen-ui";

export type ViewState =
  | "journals"
  | "documents"
  | "preferences"
  | { name: "edit"; props: { documentId?: string; journalId?: string } };

export default observer(function Container() {
  const [view, setView] = useState<ViewState>("documents");
  const { journalsStore, loading, loadingErr } = useJournalsLoader();

  if (loading) {
    return <Layout setSelected={setView}>{/* todo: loading state */}</Layout>;
  }

  if (loadingErr) {
    return (
      <Alert intent="danger" title="Journals failed to load">
        Journals failed to load: ${JSON.stringify(loadingErr)}
      </Alert>
    );
  }

  if (view === "preferences") {
    return (
      <Layout selected="preferences" setSelected={setView}>
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Preferences setView={setView} />
        </JournalsStoreContext.Provider>
      </Layout>
    );
  }

  if (view === "documents") {
    return (
      <Layout selected="documents" setSelected={setView}>
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Documents setView={setView} />
        </JournalsStoreContext.Provider>
      </Layout>
    );
  }

  if (typeof view === "object" && view.name === "edit") {
    return (
      <Pane padding={50}>
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Editor
            documentId={view.props.documentId}
            // journalId={view.props.journalId} todo: track last selected journal id and pass through
            setView={setView}
          />
        </JournalsStoreContext.Provider>
      </Pane>
    );
  }

  if (view === "journals") {
    return (
      <Layout selected={view} setSelected={setView}>
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Journals />
        </JournalsStoreContext.Provider>
      </Layout>
    );
  }

  return <div>¯\_(ヅ)_/¯</div>;
});
