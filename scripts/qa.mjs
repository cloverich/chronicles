/**
 * Drive a running Chronicles over the DevTools protocol for a final QA pass.
 * Start the app with `--remote-debugging-port=9333` (packaged) or
 * `CHRONICLES_DEBUG_PORT=9333` (dev), then:
 *
 *   node scripts/qa.mjs eval '<js body; may await and return>'
 *   node scripts/qa.mjs layout '<css selector>' [--widths 480,800,1280] [--shot out.png]
 *   node scripts/qa.mjs click <x>,<y> [--shot out.png]
 *
 * `layout` reports, at each width, every matched box whose content is clipped
 * or scrolls (except `.truncate` and `.overflow-x-auto`, which do so on
 * purpose), matched boxes that intersect without nesting, and buttons pushed
 * outside their scroll container. Text checks can't see these; screenshots
 * only show the one state captured. Exits 1 on any finding.
 */
const [cmd, arg, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const port = process.env.QA_PORT ?? "9333";

const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(
  targets.find((t) => t.type === "page").webSocketDebuggerUrl,
);
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  pending.get(msg.id)?.(msg);
};
const call = (method, params) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (body) => {
  const r = await call("Runtime.evaluate", {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.exception?.description);
  }
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => (ws.onopen = r));

const LAYOUT = (selector) => `
  const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
    .filter((e) => e.getClientRects().length);
  const label = (e) => (e.innerText || e.tagName).slice(0, 40).replace(/\\n/g, " | ");
  const out = [];
  for (const e of els) {
    if (e.matches(".truncate, .truncate *, .overflow-x-auto")) continue;
    if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 8)
      out.push("overflow: " + label(e));
  }
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        out.push("overlap: " + label(els[i]) + " / " + label(els[j]));
    }
  for (const b of els.filter((e) => e.matches("button"))) {
    const box = b.closest(".overflow-x-auto")?.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    if (box && (r.right > box.right + 1 || r.left < box.left - 1))
      out.push("offscreen: " + label(b));
  }
  return out;`;

let findings = [];
if (cmd === "eval") {
  console.log(JSON.stringify(await evaluate(arg), null, 1));
} else if (cmd === "click") {
  const [x, y] = arg.split(",").map(Number);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await call("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  }
  await sleep(800);
} else if (cmd === "layout") {
  for (const width of (flag("widths") ?? "800").split(",").map(Number)) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(300);
    const found = await evaluate(LAYOUT(arg));
    console.log(`width ${width}: ${found.length ? "" : "ok"}`);
    for (const f of found) console.log(`  ${f}`);
    findings = findings.concat(found);
  }
} else {
  console.error("usage: qa.mjs eval|layout|click …");
  process.exit(2);
}

const shot = flag("shot");
if (shot) {
  const r = await call("Page.captureScreenshot", { format: "png" });
  (await import("fs")).writeFileSync(
    shot,
    Buffer.from(r.result.data, "base64"),
  );
}
await call("Emulation.clearDeviceMetricsOverride", {});
ws.close();
process.exit(findings.length ? 1 : 0);
