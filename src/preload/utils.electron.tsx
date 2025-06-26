// In renderer process (web page).
import { ipcRenderer } from "electron";

// Map middle click to "inspect element" for debugging
window.onauxclick = (e) => {
  // apparently button 1 is middle click
  if (e.button !== 1) return;
  ipcRenderer.send("inspect-element", { x: e.x, y: e.y });
};
