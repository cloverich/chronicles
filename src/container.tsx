import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Layout from "./layout";
import Config from "./config";
import Journals from './views/journals';
import Documents from './views/documents';
import Editor from './views/edit';
import { useJournals } from './useJournals';
import { useSearch } from "./hooks/useSearch";
import { Alert } from 'evergreen-ui';
// import { useContent } from './hooks/documents';
import Journal from "./journal";

// todo: less stupid when i have > 20 minutes to do anything
import { ClientContext } from "./client/context";
import { getClient } from "./loadclient.electron";
import { Client } from "./client";

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
    return <div>¯\_(ヅ)_/¯</div>;
  }

  // I don't actually need to inject it... its exported as a singleton...
  return <Container />;
}


export type ViewState = 'journals' | 'documents' | { name: 'edit', props: { documentId?: string; journalId?: string; }};

const Container = observer(() => {
  const [view, setView] = useState<ViewState>("documents");
  const { journals, loading, loadingErr }  = useJournals();
  const searchState = useSearch();

  if (loading) {
    return (
      <Layout
        tabs={['journals', 'documents']}
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

  if (view === "documents") {
    return (
      <Layout
        tabs={['journals', 'documents']}
        selected="documents"
        setSelected={setView}
      >
        <Documents setView={setView} />
      </Layout>
    );
  }

  if (typeof view === 'object' && view.name === 'edit') {
    return (
      <Layout
        tabs={['journals', 'documents']}
        selected="documents"
        setSelected={setView}
      >
        <Editor 
          documentId={view.props.documentId} 
          // journalId={view.props.journalId} todo: track last selected journal id and pass through
          setView={setView} 
        />
      </Layout>
    );
  }

  if (view === "journals") {
    return (
      <Layout
        tabs={['journals', 'documents']}
        selected={view}
        setSelected={setView}
      >
        <Journals />
      </Layout>
    );
  }
  

  return <div>¯\_(ヅ)_/¯</div>;
});
