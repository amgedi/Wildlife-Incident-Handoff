/** Desktop shell geometry verification — measures the REAL compiled EXE. */
const sizes = [
  { name: "restored-default", w: null, h: null },
  { name: "900x650", w: 900, h: 650 },
  { name: "1024x768", w: 1024, h: 768 },
  { name: "1366x768", w: 1366, h: 768 },
  { name: "1600x900", w: 1600, h: 900 },
];

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error("ws error")));
  });
}
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function evalJs(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "page error");
  return r.result.value;
}

const page = await (await fetch("http://127.0.0.1:9222/json")).json().then((l) => l.find((t) => t.type === "page"));
const ws = await connect(page.webSocketDebuggerUrl);
const cdp = new Cdp(ws);

const results = [];
let failures = 0;

async function measure(label) {
  const g = await evalJs(cdp, `(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    return {
      vw: window.innerWidth,
      titlebar: rect(".titlebar"),
      sidebar: rect(".sidebar"),
      main: rect(".main-area"),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  const tol = 2;
  const checks = [
    ["titlebar full width", Math.abs(g.titlebar.x) <= tol && Math.abs(g.titlebar.w - g.vw) <= tol],
    ["titlebar at top", Math.abs(g.titlebar.y) <= tol],
    ["sidebar at left", Math.abs(g.sidebar.x) <= tol],
    ["sidebar below titlebar", g.sidebar.y >= g.titlebar.h - tol],
    ["main left = sidebar right", Math.abs(g.main.x - g.sidebar.right) <= tol],
    ["main right = viewport", Math.abs(g.main.right - g.vw) <= tol],
    ["no horizontal overflow", !g.overflowX],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) failures += failed.length;
  results.push({ label, vw: g.vw, checks: Object.fromEntries(checks), failed: failed.map(([n]) => n) });
  if (failed.length) console.log("   raw:", JSON.stringify({ titlebar: g.titlebar, sidebar: g.sidebar, main: g.main }));
  console.log((failed.length === 0 ? "PASS" : "FAIL") + " | " + label + " (vw=" + g.vw + ")" + (failed.length ? " -> " + failed.map((f) => f[0]).join("; ") : ""));
}

for (const size of sizes) {
  if (size.w) {
    // resize via window.setMaximumSize-independent CDP metrics emulation is not
    // available in Tauri; resize through the window API instead:
    await evalJs(cdp, `(async () => {
      const w = window.__TAURI__.window.getCurrentWindow();
      await w.setSize(new (window.__TAURI__.dpi?.LogicalSize ?? window.__TAURI__.window.LogicalSize)(${size.w}, ${size.h}));
      if (w.isMaximized?.()) await w.toggleMaximize();
      return true;
    })()`);
    await sleep(800);
  }
  await measure(size.name);
}

// Maximized
await evalJs(cdp, `(async () => { const w = window.__TAURI__.window.getCurrentWindow(); await w.maximize(); return true; })()`);
await sleep(900);
await measure("maximized");
// Restore
await evalJs(cdp, `(async () => { const w = window.__TAURI__.window.getCurrentWindow(); await w.toggleMaximize(); return true; })()`);
await sleep(900);
await measure("restored-after-maximize");

// Page sweep at current size
for (const route of ["/", "/incidents", "/incidents/new", "/examples", "/settings", "/network"]) {
  await evalJs(cdp, `location.href = '${route}'`);
  await sleep(1200);
  await measure("page " + route);
}

console.log("FAILURES=" + failures);
ws.close();
process.exit(failures > 0 ? 1 : 0);
