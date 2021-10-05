import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Layout from "./layout";
import Preferences from "./views/preferences";
import Journals from './views/journals';
import Documents from './views/documents';
import Editor from './views/edit';
import { useJournals } from './useJournals';
import { Alert } from 'evergreen-ui';
import { getClient } from "./loadclient.electron";
import { Client } from "./client";
import { JournalsStoreContext } from './useJournals';

/**
 * Wrap the main container and supply the API client, which
 * needs to wait for a signal from Electron to be ready.
 */
export default function ClientInjectingContainer() {
  const [client, setClient] = useState<Client>();

  async function waitForClient() {
    const client = await getClient();
    setClient(client);
  }
  useEffect(() => {
    waitForClient();
  }, []);

  if (!client) {
    // todo: better loading state...
    return <div>¯\_(ヅ)_/¯</div>;
  }

  // I don't actually need to inject it... its exported as a singleton...
  return <Container />;
}


export type ViewState = 'journals' | 'documents' | 'preferences' | { name: 'edit', props: { documentId?: string; journalId?: string; }};

const Container = observer(() => {
  const [view, setView] = useState<ViewState>("documents");
  const { journalsStore, loading, loadingErr }  = useJournals();

  if (loading) {
    return (
      <Layout
        setSelected={setView}
      >
       {/* todo: loading state */} 
      </Layout>
    )
  }

  if (loadingErr) {
    return (
      <Alert intent="danger" title="Journals failed to load">
        Journals failed to load: ${JSON.stringify(loadingErr)}
      </Alert>
    )
  }

  if (view === 'preferences') {
    return (
      <Layout
        selected="preferences"
        setSelected={setView}
      >
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Preferences setView={setView} />
        </JournalsStoreContext.Provider>
      </Layout>
    )
  }

  if (view === "documents") {
    return (
      <Layout
        selected="documents"
        setSelected={setView}
      >
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Documents setView={setView} />
        </JournalsStoreContext.Provider>        
      </Layout>
    );
  }

  if (typeof view === 'object' && view.name === 'edit') {
    return (
      <Layout
        selected="documents"
        setSelected={setView}
      >
        <JournalsStoreContext.Provider value={journalsStore!}>
          <Editor 
            documentId={view.props.documentId} 
            // journalId={view.props.journalId} todo: track last selected journal id and pass through
            setView={setView} 
          />
        </JournalsStoreContext.Provider>
      </Layout>
    );
  }

  if (view === "journals") {
    return (
      <Layout
        selected={view}
        setSelected={setView}
      >

        <JournalsStoreContext.Provider value={journalsStore!}>
          <Journals />
        </JournalsStoreContext.Provider>
      </Layout>
    );
  }
  

  return <div>¯\_(ヅ)_/¯</div>;
});
