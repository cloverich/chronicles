import React from "react";
import { createRoot } from "react-dom/client";
import Container from "./container";
import "./index.css";
import "./typography.css";
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
