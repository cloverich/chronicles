import React, { useState, useEffect } from "react";
import Layout from "./layout";
import Config from "./config";

import { useContent, useJournals, JournalsContext } from "./hooks"; // name not at all confusing
import Journal from "./journal";

// todo: less stupid when i have > 20 minutes to do anything
import { ClientContext } from "./client/context";
import { getClient } from "./loadclient.electron";
import { Client } from "./client";

export default function RealContainer() {
  const [client, setClient] = useState<Client>();

  async function waitForClient() {
    console.log("waitForClient");
    const client = await getClient();
    console.log("gotClient", client);
    setClient(client);
  }
  useEffect(() => {
    console.log("waiting for client!");
    waitForClient();
  }, []);

  if (!client) {
    console.log("not client!");
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
