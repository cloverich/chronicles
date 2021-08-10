import React from "react";
import ReactDOM from "react-dom";
import Container from "./container";
import "./app.css";
import "./typography.css";
import { listenLinks } from "./utils.electron";

listenLinks();

ReactDOM.render(
  <div>
    <Container />
  </div>,
  document.getElementById("app")
);
