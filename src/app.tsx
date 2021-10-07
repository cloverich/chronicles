import React from "react";
import ReactDOM from "react-dom";
import Container from "./container";
import "./app.css";
import "./typography.css";
import { listenLinks } from "./utils.electron";
import remote from '@electron/remote';

listenLinks();

// Gives me a quick inspect element for debugging. 
// todo: When I re-productionize the app, make this a debug only
// handler
// todo: this is middle and right clicks. I just want middle clicks.
window.onauxclick = (e) => {
  remote.getCurrentWindow().webContents.inspectElement(e.x, e.y)
}

ReactDOM.render(
  <div>
    <Container />
  </div>,
  document.getElementById("app")
);
