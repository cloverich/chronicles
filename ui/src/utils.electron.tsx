// In renderer process (web page).
const { ipcRenderer } = require("electron");

/**
 * NOTE: Copied from chronicles4
 *
 * Most display items are rendered via markdown. There is no built-in way
 * to convert <a> tags to use target='_blank', but this is the only way to get
 * a chrome app to actually open a new link. Below is a hack to treat all links
 * not starting with a # (ex: #/internal/app/link) as an external link request,
 * and window.open defaults to opening a new window / tab
 */
function externalLinksListener(event: any) {
  console.log(event.target);
  // hopefully only relevent on <a href="..."> elements
  if (event.target.tagName !== "A") return;

  const link = event.target.getAttribute("href");
  // don't navigate the main window to an external url
  event.preventDefault();

  // if its not a reference link, open an external browser:
  if (link && link.indexOf("#") !== 0) {
    ipcRenderer.send("link-click", link);
  }
}

/**
 * Listen for link click's and open in an external browser.
 * Otherwise, links open in _this_ window o.0
 */
export function listenLinks() {
  document.addEventListener("click", externalLinksListener);
  document.addEventListener("auxclick", externalLinksListener);

  // Return a function for removing the listener.. I used to use this in hot-reloading.
  // Might use it again...
  return () => {
    document.removeEventListener("click", externalLinksListener);
    document.removeEventListener("auxclick", externalLinksListener);
  };
}
