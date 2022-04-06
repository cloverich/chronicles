import React from "react";
import ReactDOM from "react-dom";
import Container from "./container";
import "./index.css";
import "./typography.css";
import { HashRouter } from 'react-router-dom';

ReactDOM.render(
  <>
    <HashRouter>
      <Container />
    </HashRouter>
  </>,
  document.getElementById("app")
);
