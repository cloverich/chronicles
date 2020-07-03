import React from "react";
import ReactDOM from "react-dom";
import API from "./api";
import Store from "./store";
import Docs from "./docs";
import Editor from "./editor";
import Container from "./container";
// Stylesheet
import "./app.css";

ReactDOM.render(
  <div>
    <Container />
  </div>,
  document.getElementById("app")
);
