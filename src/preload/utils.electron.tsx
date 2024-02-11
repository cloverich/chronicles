// In renderer process (web page).
const { ipcRenderer } = require("electron");

// Map middle click to "inspect element" for debugging
window.onauxclick = (e) => {
  // apparently button 1 is middle click
  if (e.button !== 1) return;
  ipcRenderer.send("inspect-element", { x: e.x, y: e.y });
};
