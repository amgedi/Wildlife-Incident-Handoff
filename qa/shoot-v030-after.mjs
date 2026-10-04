/** 0.3 AFTER screenshots from the real desktop EXE (CDP :9222). */
import fs from "node:fs";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
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
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

const outDir = "screenshots/v030-after";
fs.mkdirSync(outDir, { recursive: true });

// seed: professional workspace + name + frosted material (raw IDB — the
// packaged EXE cannot import TS source modules).
const seedInfo = await evalJs(`(async () => {
  const db = await new Promise((res, rej) => {
    const rq = indexedDB.open("wildlife-incident-handoff");
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  const storeNames = [...db.objectStoreNames];
  const kvStore = "settings";
  const read = await new Promise((res) => {
    const tx = db.transaction(kvStore, "readonly");
    const r = tx.objectStore(kvStore).get("app-settings");
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(undefined);
  });
  await new Promise((res, rej) => {
    const tx = db.transaction(kvStore, "readwrite");
    tx.objectStore(kvStore).put({ key: "app-settings", value: { ...(read?.value ?? {}), onboarded: true, workspace: "professional", displayName: "Amged", theme: "forest-dark", material: "frosted" } });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
  return JSON.stringify({ storeNames, kvStore });
})()`);
console.log("seed:", seedInfo);
// theme/material switching via localStorage mirror is unavailable — use the
// settings dataset attribute directly (the app re-applies on load).
const setTheme = (th) => evalJs(`document.documentElement.dataset.theme = "${th}"; document.documentElement.dataset.material = arguments.length ? undefined : document.documentElement.dataset.material; "ok"`);
const setMaterial = (mat) => evalJs(`document.documentElement.dataset.material = "${mat}"; "ok"`);

const routes = [
  ["home", "/"],
  ["dashboard", "/network"],
  ["network-map", "/network?view=map"],
  ["incidents-list", "/incidents"],
  ["new-intake", "/incidents/new"],
  ["settings", "/settings"],
  ["help", "/help"],
];
for (const [name, route] of routes) {
  await nav("http://tauri.localhost" + route);
  await shot(`${outDir}/${name}.png`);
}

// dashboard states
await nav("http://tauri.localhost/network");
await sleep(1500);
// stage selected (pickup)
await evalJs(`(() => { const b = document.querySelector('.rflow-stage[data-stage="pickup"]'); if (b) b.click(); return !!b; })()`);
await sleep(700);
await shot(`${outDir}/response-flow-selected.png`);
await evalJs(`(() => { const b = document.querySelector('.rflow-stage[data-stage="pickup"]'); if (b) b.click(); return true; })()`);
await sleep(300);

// incidents: table + inspector
await nav("http://tauri.localhost/incidents");
await sleep(1800);
await evalJs(`(() => {
  const seg = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === "Table");
  if (seg) seg.click();
  return !!seg;
})()`);
await sleep(700);
await shot(`${outDir}/incidents-table.png`);
await evalJs(`(() => {
  const row = document.querySelector('tbody tr');
  if (row) row.click();
  return !!row;
})()`);
await sleep(800);
await shot(`${outDir}/incident-inspector.png`);

// profile + devices + appearance + country
await nav("http://tauri.localhost/settings?section=profile");
await sleep(1600);
await shot(`${outDir}/profile.png`);
await nav("http://tauri.localhost/settings?section=devices");
await sleep(1400);
await shot(`${outDir}/devices.png`);
await nav("http://tauri.localhost/settings?section=appearance");
await sleep(1400);
await shot(`${outDir}/appearance.png`);

// theme matrix on the dashboard
const themes = ["forest-dark", "forest-night", "midnight-ops", "storm", "aurora", "mono-dark", "forest-light", "sand"];
for (const th of themes) {
  await evalJs(`document.documentElement.dataset.theme = "${th}"; "${th}"`);
  await sleep(900);
  await shot(`${outDir}/theme-${th}.png`);
}

// material matrix (frosted / glass) on forest-dark
for (const mat of ["solid", "frosted", "glass"]) {
  await evalJs(`document.documentElement.dataset.theme = "forest-dark"; document.documentElement.dataset.material = "${mat}"; "${mat}"`);
  await sleep(900);
  await shot(`${outDir}/material-${mat}.png`);
}

// integrity review visible on dashboard (test view spam pair)
await evalJs(`document.documentElement.dataset.theme = "forest-dark"; document.documentElement.dataset.material = "frosted"; true`);
await nav("http://tauri.localhost/network");
await sleep(1800);
await evalJs(`(() => { const el = document.querySelector('[data-testid="integrity-review"]'); if (el) el.scrollIntoView({ block: "center" }); return !!el; })()`);
await sleep(400);
await shot(`${outDir}/integrity-review.png`);

await evalJs(`document.documentElement.dataset.theme = "forest-dark"; true`);

ws.close();
process.exit(0);
