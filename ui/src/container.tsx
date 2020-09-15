import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Layout from "./layout";
import Config from "./config";

import { useJournals, JournalsContext } from "./hooks/useJournals"; // name not at all confusing
import { useSearch } from "./hooks/useSearch";
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

const Container = observer(() => {
  const [view, setView] = useState<"config" | "journal">("journal");
  const journals = useJournals();
  const searchState = useSearch();

  useEffect(() => {
    journals.load();
  }, []);

  // todo: error states :D
  if (journals.loading) {
    return <h1>Loading journals...</h1>;
  }

  if (view === "config") {
    return (
      <Layout
        tabs={["config", "journal"]}
        selected={view}
        setSelected={setView}
      >
        <Config />
      </Layout>
    );
  }

  if (view === "journal") {
    return (
      <Layout
        tabs={["config", "journal"]}
        selected={view}
        setSelected={setView}
      >
        <Journal />
      </Layout>
    );
  }

  return <div>¯\_(ヅ)_/¯</div>;
});
