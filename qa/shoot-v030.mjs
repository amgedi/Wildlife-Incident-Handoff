/** Capture screenshots of a list of routes/states from the running desktop app (CDP :9222). */
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
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails));
  return r.result.value ?? null;
}
async function shot(out) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("saved", out);
}
async function nav(url, waitMs = 2200) {
  // SPA: use history push + router-friendly full navigate via location.assign for hash-less router
  await send("Page.navigate", { url });
  await sleep(waitMs);
}
async function clickByText(selector, text) {
  return evalJs(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const el = els.find(e => e.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

const outDir = process.argv[2] ?? "screenshots/v030-before";
fs.mkdirSync(outDir, { recursive: true });

// Route captures
const routes = [
  ["home", "/"],
  ["network", "/network"],
  ["network-map", "/network?view=map"],
  ["incidents", "/incidents"],
  ["new-intake", "/incidents/new"],
  ["settings", "/settings"],
  ["profile", "/settings?section=profile"],
  ["help", "/help"],
];
for (const [name, route] of routes) {
  await nav("http://tauri.localhost" + route);
  await shot(`${outDir}/${name}.png`);
}

// Interaction states on dashboard
await nav("http://tauri.localhost/network");
await sleep(1500);
// Try to interact with response flow: find stage buttons
const stageInfo = await evalJs(`(() => {
  const btns = [...document.querySelectorAll('[data-stage], [class*="stage"] button, [aria-label*="stage" i]')];
  return { count: btns.length, sample: btns.slice(0, 10).map(b => (b.getAttribute('data-stage') ?? b.textContent.trim().slice(0, 30))) };
})()`);
console.log("stage elements:", JSON.stringify(stageInfo));
await shot(`${outDir}/network-2.png`);

// Settings sections
const sections = await evalJs(`(() => {
  const els = [...document.querySelectorAll('button, a')].filter(e => /appearance|profile|devices|sync|notifications|privacy|accessibility|advanced|about|backup/i.test(e.textContent));
  return els.map(e => e.textContent.trim().slice(0, 40));
})()`);
console.log("settings-ish controls:", JSON.stringify(sections));

ws.close();
process.exit(0);
