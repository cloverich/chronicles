import React, { useState } from "react";
import Layout from "./layout";
import Journals from "./journals";

import { useContent, useJournals, JournalsContext } from "./hooks"; // name not at all confusing
import Journal from "./journal";

export default function Container() {
  const [view, setView] = useState<"config" | "journal">("config");
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
          <Journals {...journalsState} />
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
