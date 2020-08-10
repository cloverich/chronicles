import React, { useState, useEffect } from "react";
import Layout from "./layout";
import Config from "./config";

import { useContent, useJournals, JournalsContext } from "./hooks"; // name not at all confusing
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

  return (
    <ClientContext.Provider value={client}>
      <Container />
    </ClientContext.Provider>
  );
}

function Container() {
  const [view, setView] = useState<"config" | "journal">("journal");
  const journalsState = useJournals();
  const contentState = useContent();

  if (view === "config") {
    return (
      <JournalsContext.Provider value={journalsState.journals}>
        <Layout
          tabs={["config", "journal"]}
          selected={view}
          setSelected={setView}
        >
          <Config {...journalsState} />
        </Layout>
      </JournalsContext.Provider>
    );
  }

  if (view === "journal") {
    return (
      <JournalsContext.Provider value={journalsState.journals}>
        <Layout
          tabs={["config", "journal"]}
          selected={view}
          setSelected={setView}
        >
          <Journal {...contentState} journals={journalsState.journals} />
        </Layout>
      </JournalsContext.Provider>
    );
  }

  return <div>¯\_(ヅ)_/¯</div>;
}
