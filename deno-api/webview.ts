import { WebView } from "https://raw.githubusercontent.com/webview/webview_deno/master/mod.ts";

const wv = new WebView({
  title: "Chronicles",
  url: "http://localhost:9000",
  width: 400,
  height: 600,
  resizable: true,
  frameless: false,
});

await wv.run();
