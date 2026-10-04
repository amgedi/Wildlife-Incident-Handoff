// Minimal CDP driver for the Tauri/WebView2 QA instance on :9333
// usage: node qa/cdp.mjs eval "<js>"          -> prints JSON result
//        node qa/cdp.mjs shot <out.png>       -> screenshot
//        node qa/cdp.mjs nav <url>
import fs from "node:fs";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

const [cmd, arg] = process.argv.slice(2);
if (cmd === "eval") {
  const r = await send("Runtime.evaluate", {
    expression: process.argv[3],
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    console.error("EXCEPTION:", JSON.stringify(r.exceptionDetails, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(r.result.value ?? null));
} else if (cmd === "shot") {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(arg, Buffer.from(r.data, "base64"));
  console.log("saved", arg);
} else if (cmd === "nav") {
  await send("Page.navigate", { url: arg });
  await new Promise((r) => setTimeout(r, 1500));
  console.log("navigated", arg);
} else {
  console.error("unknown cmd");
  process.exit(1);
}
ws.close();
process.exit(0);
