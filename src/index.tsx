import React from "react";
import { createRoot } from "react-dom/client";
import Container from "./container";
import "./index-compiled.css"; // generated by tailwindcss; see package.jsons scripts
import "./typography.css";
import "./prism-code-theme.css";
import { HashRouter } from "react-router-dom";
import "mobx-react-lite/batchingForReactDom";

const root = createRoot(document.getElementById("app")!);

root.render(
  <>
    <HashRouter>
      <Container />
    </HashRouter>
  </>,
);
