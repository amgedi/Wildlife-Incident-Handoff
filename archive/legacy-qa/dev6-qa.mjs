/** 0.3.0-dev.6 runtime QA against the RUNNING packaged EXE (:9222). */
import fs from "node:fs";

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const d = JSON.parse(e.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
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
const nav = async (path, w = 2200) => { await send("Page.navigate", { url: "http://tauri.localhost" + path }); await sleep(w); };
const shot = async (out) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("saved", out);
};
const results = [];
const record = (name, pass, note = "") => { results.push({ name, pass, note }); console.log((pass ? "PASS" : "FAIL") + " | " + name + (note ? " | " + note : "")); };
fs.mkdirSync("screenshots/v030-dev6-after", { recursive: true });

// escape scan across pages
let escapeTotal = 0;
for (const p of ["/network", "/incidents", "/profile", "/help"]) {
  await nav(p, 1800);
  const scan = await ev(`(() => { const t = document.body.textContent || ""; const m = t.match(/\\\\u[dD][0-9a-fA-F]{2}|\\\\u[0-9a-fA-F]{4}/g); return m ? m.length : 0; })()`);
  escapeTotal += scan;
}
record("escaped unicode: 0 across network/incidents/profile/help", escapeTotal === 0, String(escapeTotal));

// Live Activity geometry
await nav("/network", 2500);
const la = await ev(`(() => {
  const el = document.querySelector('[data-testid="live-activity-v5"]');
  if (!el) return { present: false };
  const evt = el.querySelector(".ops-feed-event");
  const er = evt?.getBoundingClientRect();
  return { present: true, eventW: er ? Math.round(er.width) : null, eventH: er ? Math.round(er.height) : null };
})()`);
record("Live Activity: event content column not collapsed", la.present && la.eventW != null && la.eventW >= 200, JSON.stringify(la));

// sidebar: Local only gone, no orphan divider
const sb = await ev(`(() => {
  const side = document.querySelector("aside.sidebar");
  const t = side?.textContent ?? "";
  return { hasLocalOnly: /local only/i.test(t), statusBlock: !!side?.querySelector(".sidebar-status") };
})()`);
record("sidebar: 'Local only' removed", !sb.hasLocalOnly && !sb.statusBlock, JSON.stringify(sb));

// titlebar search centering at current width
const tb = await ev(`(() => {
  const b = document.querySelector('[data-testid="titlebar-search"]');
  if (!b) return { found: false };
  const r = b.getBoundingClientRect();
  return { found: true, windowW: window.innerWidth, offset: Math.round(r.left + r.width / 2 - window.innerWidth / 2) };
})()`);
record("titlebar: search centered (|offset| <= 8px)", tb.found && Math.abs(tb.offset) <= 8, JSON.stringify(tb));

// bookmark flow on incidents list
await nav("/incidents", 2200);
const bmBefore = await ev(`(() => { const b = document.querySelector(".bookmark-btn"); if (!b) return "nf"; return b.classList.contains("active") ? "active" : "inactive"; })()`);
if (bmBefore === "inactive") {
  await ev(`(() => { document.querySelector(".bookmark-btn").click(); })()`);
  await sleep(900);
}
const bmState = await ev(`(() => { const b = document.querySelector(".bookmark-btn.active"); return !!b; })()`);
record("bookmark: star active on incident card", bmBefore !== "nf" && bmState, "was:" + bmBefore);
await shot("screenshots/v030-dev6-after/bookmarked-card.png");

// bookmarked deep link shows the incident
await nav("/incidents?bookmark=1", 2000);
const bmList = await ev(`(() => { const cards = document.querySelectorAll("[data-incident-id]"); return { cards: cards.length }; })()`);
record("bookmark: ?bookmark=1 view filters to bookmarked", bmList.cards >= 1, JSON.stringify(bmList));

// context menu on card
await nav("/incidents", 2000);
const ctx = await ev(`(() => {
  const card = document.querySelector("[data-incident-id] .report-card") ?? document.querySelector(".incident-card");
  if (!card) return { found: false };
  card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 300, clientY: 300 }));
  return { found: true };
})()`);
await sleep(600);
const menuOpen = await ev(`(() => ({ menu: !!document.querySelector(".ctx-menu"), items: document.querySelectorAll(".ctx-item").length }))()`);
record("context menu: opens on incident card right-click", ctx.found && menuOpen.menu, JSON.stringify(menuOpen));
await shot("screenshots/v030-dev6-after/context-menu.png");
await ev(`(() => { document.querySelector(".ctx-scrim")?.click(); })()`);
await sleep(300);

// map inspector: close button top-right + intel rows (Test View provides mappable demo incidents)
await nav("/network", 2200);
await ev();
await sleep(2500);
await nav("/network?view=map", 3500);
await ev(`(() => { const c = document.querySelector("canvas"); if (!c) return; const r = c.getBoundingClientRect(); for (let i=0;i<6;i++) c.dispatchEvent(new WheelEvent("wheel",{deltaY:-500,clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true})); })()`);
await sleep(2200);
const clicked = await ev(`(() => { const m = document.querySelector(".maplibregl-marker"); if (!m) return "nf"; const r = m.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`);
if (clicked !== "nf") {
  const pos = JSON.parse(clicked);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
  await sleep(1400);
  const insp = await ev(`(() => {
    const el = document.querySelector(".map-inspector");
    if (!el) return { open: false };
    const close = el.querySelector("button");
    const cr = close?.getBoundingClientRect(); const pr = el.getBoundingClientRect();
    const body = el.textContent;
    return {
      open: true,
      closeTopRight: cr ? (cr.top - pr.top < 30 && pr.right - cr.right < 30) : false,
      hasIntelRows: el.querySelectorAll(".intel-row").length,
      hasBookmark: !!el.querySelector(".bookmark-btn"),
      hasMeasureFrom: /Measure from here/.test(body),
      escapes: /\\\\u[dD][0-9a-fA-F]{2}/.test(body),
    };
  })()`);
  record("map inspector V6: close top-right, intel rows, bookmark, measure-from", insp.open && insp.closeTopRight && insp.hasIntelRows > 0 && insp.hasBookmark && insp.hasMeasureFrom && !insp.escapes, JSON.stringify(insp));
  await shot("screenshots/v030-dev6-after/map-inspector-v6.png");
} else {
  record("map inspector V6: (no marker to click — skipped)", false, "no marker");
}

console.log("RESULTS_JSON=" + JSON.stringify(results));
ws.close();
process.exit(0);
