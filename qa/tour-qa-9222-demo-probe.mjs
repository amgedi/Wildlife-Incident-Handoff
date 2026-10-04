/**
 * Verifies the demo-incident tour targets in the RUNNING EXE (:9222).
 * The bundled build predates the /examples route fix, so the tour cannot be
 * launched from the UI there; instead we materialize demo incidents via the
 * dashboard's Test view toggle and verify every demo tour target exists.
 */
const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
function send(method, params = {}) { return new Promise((res, rej) => { const m = ++id; pending.set(m, { res, rej }); ws.send(JSON.stringify({ id: m, method, params })); }); }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).res(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const ev = async (x) => {
  const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "page error");
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (finder) => {
  for (let i = 0; i < 20; i++) {
    const pos = await ev(`(() => { const el = ${finder}; if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
    if (pos) { for (const t of ["mousePressed","mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pos.x, y: pos.y, button: "left", clickCount: 1 }); await sleep(400); return; }
    await sleep(250);
  }
  throw new Error("not found");
};

await ev(`history.pushState({}, '', '/network'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
await sleep(900);
const testBtn = `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Test view') || b.textContent.includes('Testansicht'))`;
await click(`(${testBtn})`);
await sleep(2500);
// open a demo incident detail page (Test view materialized buildDemoIncidents)
const demoId = await ev(`(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('wildlife-incident-handoff'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = await new Promise((res) => { const rq = db.transaction('incidents').objectStore('incidents').getAll(); rq.onsuccess = () => res(rq.result); });
  const demo = all.find((i) => i.isDemo);
  return demo ? demo.id : null;
})()`);
if (!demoId) throw new Error("no demo incident found after Test view");
await ev(`history.pushState({}, '', '/incidents/${demoId}'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
await sleep(1500);
await ev(`(() => { const b = document.querySelector('[data-tour-id="tab-timeline"]'); if (b) b.click(); })()`);
await sleep(900);
for (const t of ["incident-header", "tab-timeline", "demo-banner"]) {
  const ok = await ev(`(() => { const el = document.querySelector('[data-tour-id="${t}"]'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
  console.log(`EXE demo target ${t}:`, ok);
}
// close test view again (leave the EXE as found)
await ev(`history.pushState({}, '', '/network'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
await sleep(900);
await click(`(${testBtn})`);
await sleep(600);
console.log("test view toggled back off");
ws.close();
