/** dev.6 Part 0: reproduce reported issues in the running packaged EXE (:9222). */
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
import fs from "node:fs";
const shot = async (out) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("saved", out);
};
fs.mkdirSync("screenshots/v030-dev6-before", { recursive: true });

// --- 1. Escaped unicode scan across main pages ------------------------------
await nav("/network", 2500);
// Enable Test View with busy scenario for content
await ev(`(() => { const b = Array.from(document.querySelectorAll("button")).find(b => /Test view/i.test(b.textContent)); b && b.click(); return !!b; })()`);
await sleep(1200);
await ev(`(() => {
  const sel = document.querySelector("select");
  if (sel) { const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set; setter.call(sel, "busy"); sel.dispatchEvent(new Event("change", { bubbles: true })); }
  return true;
})()`);
await sleep(3000);
await shot("screenshots/v030-dev6-before/network-testview.png");
const scan = await ev(`(() => {
  const t = document.body.textContent || "";
  const m = t.match(/\\\\u[dD][0-9a-fA-F]{2}|\\\\u[0-9a-fA-F]{4}/g);
  return { count: m ? m.length : 0, samples: m ? m.slice(0, 6) : [], first200: (m ? t.slice(Math.max(0, t.indexOf(m[0]) - 60), t.indexOf(m[0]) + 80) : "") };
})()`);
console.log("ESCAPED UNICODE:", JSON.stringify(scan));

// --- 2. Live Activity geometry ----------------------------------------------
const la = await ev(`(() => {
  const el = document.querySelector('[data-testid="live-activity-v5"]');
  if (!el) return { present: false };
  const items = [...el.querySelectorAll(".ops-feed-item")].slice(0, 3).map(b => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  const evt = el.querySelector(".ops-feed-event");
  const er = evt?.getBoundingClientRect();
  return { present: true, items, eventW: er ? Math.round(er.width) : null, eventH: er ? Math.round(er.height) : null };
})()`);
console.log("LIVE ACTIVITY:", JSON.stringify(la));

// --- 3. Titlebar search center ----------------------------------------------
const tb = await ev(`(() => {
  const inp = document.querySelector('input[type="search"], input[placeholder*="earch"], .titlebar input');
  const win = { w: window.innerWidth };
  if (!inp) return { found: false, ...win };
  const r = inp.getBoundingClientRect();
  return { found: true, windowW: window.innerWidth, searchCenter: Math.round(r.left + r.width / 2), offset: Math.round(r.left + r.width / 2 - window.innerWidth / 2) };
})()`);
console.log("TITLEBAR SEARCH:", JSON.stringify(tb));

// --- 4. Sidebar Local only ---------------------------------------------------
const sb = await ev(`(() => {
  const t = document.querySelector("aside.sidebar")?.textContent ?? "";
  return { hasLocalOnly: /local only/i.test(t), statusBlock: !!document.querySelector(".sidebar-status") };
})()`);
console.log("SIDEBAR:", JSON.stringify(sb));
await shot("screenshots/v030-dev6-before/network-full.png");

// --- 5. Stewardship (Profile) ------------------------------------------------
await nav("/profile", 2200);
const st = await ev(`(() => {
  const t = document.querySelector("main")?.textContent ?? "";
  return {
    title: /stewardship/i.test(t),
    checkbox: !!document.querySelector('input[type="checkbox"]'),
    badges: /badge/i.test(t),
    level: /level/i.test(t),
    progress: /progress|milestone/i.test(t),
    text: t.replace(/\\s+/g, " ").slice(0, 200),
  };
})()`);
console.log("STEWARDSHIP:", JSON.stringify(st));
await shot("screenshots/v030-dev6-before/profile-stewardship.png");

// --- 6. Map popup ------------------------------------------------------------
await nav("/network?view=map", 3500);
await ev(`(() => { const c = document.querySelector("canvas"); if (!c) return; const r = c.getBoundingClientRect(); for (let i=0;i<6;i++) c.dispatchEvent(new WheelEvent("wheel",{deltaY:-500,clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true})); })()`);
await sleep(2500);
const markers = await ev(`(() => ({ markers: document.querySelectorAll(".maplibregl-marker").length }))()`);
console.log("MARKERS:", JSON.stringify(markers));
const mpos = await ev(`(() => { const m = document.querySelector(".maplibregl-marker"); if (!m) return null; const r = m.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; })()`);
if (mpos) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mpos.x + 10, y: mpos.y + 10, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mpos.x + 10, y: mpos.y + 10, button: "left", clickCount: 1 });
  await sleep(1500);
  const popup = await ev(`(() => {
    const p = document.querySelector(".maplibregl-popup") || document.querySelector("[class*=popup]");
    if (!p) return { open: false };
    const close = p.querySelector("button");
    const cr = close?.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    return { open: true, closeTopRight: cr ? (cr.top - pr.top < 40 && pr.right - cr.right < 40) : null, text: p.textContent.replace(/\\s+/g, " ").slice(0, 300) };
  })()`);
  console.log("POPUP:", JSON.stringify(popup));
  await shot("screenshots/v030-dev6-before/map-popup.png");
}

ws.close();
process.exit(0);
