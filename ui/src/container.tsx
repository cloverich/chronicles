import React, { useState } from "react";
import Layout from "./layout";
import Journals from "./journals";

import { useContent, useJournals } from "./hooks";
// name not at all confusing
import Journal from "./journal";

export default function Container() {
  const [isEditor, setEditor] = useState("");
  const [view, setView] = useState<"config" | "journal">("config");
  const journalsState = useJournals();
  const contentState = useContent();

  const turnonEdit = (content: string) => {
    setEditor(content);
  };

  const turnoffEdit = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditor("");
  };

  if (view === "config") {
    return (
      <Layout
        tabs={["config", "journal"]}
        selected={view}
        setSelected={setView}
      >
        <Journals {...journalsState} />
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
        <Journal {...contentState} journals={journalsState.journals} />
      </Layout>
    );
  }

  return <div>¯\_(ヅ)_/¯</div>;

  // if (isEditor) {
  //   return (
  //     <div className="container">
  //       <a href="#" onClick={turnoffEdit}>
  //         Turn it off
  //       </a>
  //       <div>
  //         <Editor initial={[{ children: [{ text: isEditor }] }]} />
  //       </div>
  //     </div>
  //   );
  // } else {
  //   return (
  //     <div className="container">
  //       <a href="#" onClick={turnoffEdit}>
  //         Turn it on
  //       </a>
  //       <div>
  //         <Docs edit={turnonEdit} />
  //       </div>
  //     </div>
  //   );
  // }
}
