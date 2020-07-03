import React, { useState } from "react";

import Docs from "./docs";
import Editor from "./editor";

export default function Container() {
  const [isEditor, setEditor] = useState("");

  const turnonEdit = (content: string) => {
    setEditor(content);
  };

  const turnoffEdit = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditor("");
  };

  if (isEditor) {
    return (
      <div className="container">
        <a href="#" onClick={turnoffEdit}>
          Turn it off
        </a>
        <div>
          <Editor initial={[{ children: [{ text: isEditor }] }]} />
        </div>
      </div>
    );
  } else {
    return (
      <div className="container">
        <a href="#" onClick={turnoffEdit}>
          Turn it on
        </a>
        <div>
          <Docs edit={turnonEdit} />
        </div>
      </div>
    );
  }
}
