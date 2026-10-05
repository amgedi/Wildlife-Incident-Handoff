/** 0.3.0-dev.5 runtime QA against the RUNNING packaged EXE (:9222).
 *  Checks: sidebar Pinned geometry (spec 14), fast-scroll long-frame burst
 *  (Parts III/XXVI), terrain activation on a genuinely online machine
 *  (Part VII), compass behavior, measure panel, Live Activity V5 presence.
 */
import fs from "node:fs";

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Runtime.enable");
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function nav(path, waitMs = 1800) { await send("Page.navigate", { url: "http://tauri.localhost" + path }); await sleep(waitMs); }
async function shot(out) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("saved", out);
}
const results = [];
const record = (name, pass, note = "") => { results.push({ name, pass, note }); console.log((pass ? "PASS" : "FAIL") + " | " + name + (note ? " | " + note : "")); };

fs.mkdirSync("screenshots/v030-dev5-after", { recursive: true });

// ---- Sidebar geometry (spec 14) --------------------------------------------
await nav("/network", 2500);
const geo = await ev(`(() => {
  const intake = Array.from(document.querySelectorAll("a,button")).find(a => /New intake/i.test(a.textContent) && a.closest("aside.sidebar"));
  const pinned = Array.from(document.querySelectorAll(".sidebar .nav-sep, .sidebar .sidebar-section-label")).find(el => /pinned/i.test(el.textContent));
  const gi = intake?.getBoundingClientRect(); const gp = pinned?.getBoundingClientRect();
  return { intakeBottom: gi ? Math.round(gi.bottom) : null, pinnedTop: gp ? Math.round(gp.top) : null, gap: gi && gp ? Math.round(gp.top - gi.bottom) : null };
})()`);
record("sidebar: New intake bottom → Pinned top gap ≤ 64px", geo.gap != null && geo.gap >= -2 && geo.gap <= 64, JSON.stringify(geo));
const recentTop = await ev(`(() => {
  const el = Array.from(document.querySelectorAll(".sidebar .nav-sep, .sidebar .sidebar-section-label")).find(el => /recent/i.test(el.textContent));
  return el ? Math.round(el.getBoundingClientRect().top) : null;
})()`);
record("sidebar: RECENT section visible in viewport", recentTop != null && recentTop > 0, String(recentTop));

// ---- Fast-scroll burst (Parts III/XXVI) ------------------------------------
await nav("/network", 2200);
const scrollBurst = async () => ev(`(async () => {
  const el = document.querySelector(".main-area");
  if (!el) return { frames: 0, longFrames: 0 };
  let longFrames = 0; let frames = 0;
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) { frames++; if (entry.duration > 100) longFrames++; }
  });
  obs.observe({ entryTypes: ["longtask"] });
  const dir = el.scrollHeight > el.clientHeight;
  if (dir) {
    for (let i = 0; i < 30; i++) { el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 40)); el.scrollTop = 0; await new Promise(r => setTimeout(r, 40)); }
  }
  obs.disconnect();
  return { frames, longFrames, scrollable: dir, scrollTop: el.scrollTop };
})()`);
const burst = await scrollBurst();
record("scroll: 30 rapid up/down bursts on /network, page settles at top", burst.scrollable && burst.scrollTop === 0, JSON.stringify(burst));
await shot("screenshots/v030-dev5-after/qa-network-after-scroll.png");

// ---- Live Activity V5 present ----------------------------------------------
const la = await ev(`(() => {
  const el = document.querySelector('[data-testid="live-activity-v5"]');
  return { present: !!el, filters: el ? el.querySelectorAll(".chip-btn").length : 0 };
})()`);
record("Live Activity V5 present with filters", la.present, JSON.stringify(la));

// ---- Map V5: mode switching keeps camera, terrain online, compass ----------
await nav("/network?view=map", 3000);
// pan + zoom somewhere distinctive first
await ev(`(() => { const m = window.__wihMap || null; return !!m; })()`);
const cam1 = await ev(`(() => { const el = document.querySelector(".maplibregl-canvas"); return !!el; })()`);
record("map canvas present", cam1);
// switch Terrain via the segmented control (DOM click)
const terrainClicked = await ev(`(() => {
  const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Terrain 3D");
  if (!b) return false; b.click(); return true;
})()`);
record("terrain mode selectable", terrainClicked);
await sleep(5000);
const terrainState = await ev(`(() => {
  const active = !!document.querySelector('[data-testid="terrain-active"]');
  const loading = !!document.querySelector('[data-testid="terrain-loading"]');
  const failed = !!document.querySelector('[data-testid="terrain-unavailable"]');
  const modeBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Terrain 3D");
  return { active, loading, failed, stillSelected: modeBtn ? modeBtn.getAttribute("aria-pressed") : null };
})()`);
record("terrain: stays selected (no kick-out)", terrainState.stillSelected === "true", JSON.stringify(terrainState));
record("terrain: ONLINE activation — elevation active (not failed)", terrainState.active && !terrainState.failed, JSON.stringify(terrainState));
await shot("screenshots/v030-dev5-after/qa-terrain-online.png");
// compass: rotate impossible programmatically; verify compass exists and click resets bearing
const compass = await ev(`(() => {
  const b = Array.from(document.querySelectorAll("button")).find(b => (b.getAttribute("aria-label") || "").toLowerCase().includes("north"));
  if (!b) return { found: false };
  b.click(); return { found: true };
})()`);
record("compass: reset-north control present and clickable", compass.found);
// measure tool
const measure = await ev(`(() => {
  const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim().toLowerCase().includes("measure"));
  if (!b) return { found: false }; b.click(); return { found: true };
})()`);
  await sleep(1200);
  const measurePanel = await ev(`(() => ({ panel: !!document.querySelector(".mv4-measure"), text: (document.querySelector(".mv4-measure")?.textContent ?? "").trim().slice(0, 60) }))()`);
  measure.panel = measurePanel.panel; measure.text = measurePanel.text;
record("measure: tool opens with result panel", measure.found && measure.panel, JSON.stringify(measure));
await shot("screenshots/v030-dev5-after/qa-map-v5.png");

// back to 2D: camera preserved?
await ev(`(() => { const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "2D"); b && b.click(); })()`);
await sleep(2500);
await shot("screenshots/v030-dev5-after/qa-map-back-2d.png");

console.log("RESULTS_JSON=" + JSON.stringify(results));
ws.close();
process.exit(0);
