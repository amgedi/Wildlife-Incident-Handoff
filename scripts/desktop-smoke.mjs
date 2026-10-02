/** CDP smoke-test driver for the desktop build (Node 22+, global WebSocket). */
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error("ws error")));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

import { readFileSync } from "fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJs(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page error: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}
async function waitFor(cdp, expression, timeoutMs = 10000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await evalJs(cdp, `!!(${expression})`)) return true;
    await sleep(250);
  }
  return false;
}
async function centerOf(cdp, finderJs) {
  return evalJs(cdp, `(() => { const el = ${finderJs}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return null; return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
}
async function clickFinder(cdp, finderJs, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const pos = await centerOf(cdp, finderJs);
    if (pos) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await cdp.send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
      }
      await sleep(450);
      return true;
    }
    await sleep(300);
  }
  throw new Error("element not found: " + label);
}
async function typeInto(cdp, finderJs, text) {
  // Use the native value setter + input event: robust against CDP key-event
  // flakiness and works for both <input> and <textarea> targets.
  const ok = await evalJs(cdp, `(() => {
    const el = ${finderJs};
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    return true;
  })()`);
  if (!ok) throw new Error("input not found");
  await sleep(300);
}

async function main() {
  const list = await (await fetch("http://127.0.0.1:9222/json")).json();
  const page = list.find((t) => t.type === "page" && (t.url.startsWith("tauri") || t.url.startsWith("http")));
  const ws = await connect(page.webSocketDebuggerUrl);
  const cdp = new Cdp(ws);
  await cdp.send("Runtime.enable");
  // Purge any service worker/caches left by older desktop builds.
  await evalJs(cdp, `(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    for (const r of regs) await r.unregister();
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
    return true;
  })()`);
  const results = [];
  const record = (name, pass, note = "") => { results.push({ name, pass }); console.log((pass ? "PASS" : "FAIL") + " | " + name + (note ? " | " + note : "")); };

  // Fresh wizard
  console.log("phase: open wizard");
  await evalJs(cdp, `location.href = '/incidents/new'`);
  await waitFor(cdp, `document.body && document.body?.textContent?.includes('What happened?')`);
  await sleep(800);
  console.log("phase: fill step 1");

  // Step 1: fill summary, pick type
  await typeInto(cdp, `document.querySelector('textarea')`, "Desktop smoke test: bird beside a road, unable to fly.");
  await clickFinder(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose'))`, "incident type select");
  await clickFinder(cdp, `Array.from(document.querySelectorAll('[role="option"]')).find(o => o.textContent.trim() === 'Injured wildlife')`, "Injured wildlife option");

  const nextBtn = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Next'))`;
  for (let step = 2; step <= 10; step++) {
    await clickFinder(cdp, nextBtn, "Next -> " + step);
    const ok = await waitFor(cdp, `document.body?.textContent?.includes('step ${step} of 10')`, 6000);
    if (!ok) { record("wizard step " + step, false); throw new Error("stuck at step " + step); }
  }
  record("wizard reaches review", true);

  console.log("phase: create");
  await clickFinder(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create incident'))`, "Create incident");
  const created = await waitFor(cdp, `document.body?.textContent?.includes('Overview') && /WIH-\\d{4}-\\d{6}/.test(document.body.textContent)`, 10000);
  record("incident created + detail opens", created);
  const ref = await evalJs(cdp, `(document.body.textContent.match(/WIH-\\d{4}-\\d{6}/) || ['none'])[0]`);
  const summaryVisible = await evalJs(cdp, `document.body?.textContent?.includes('Desktop smoke test')`);
  record("summary preserved on overview", summaryVisible, ref);
  console.log("INCIDENT_REF=" + ref);

  console.log("phase: about");
  await evalJs(cdp, `(() => { const a = document.querySelector('a[href="/settings"]'); if (!a) return false; a.click(); return true; })()`);
  await sleep(900);
  await evalJs(cdp, `(() => { const b = Array.from(document.querySelectorAll('nav[aria-label="Settings sections"] button')).find(b => b.textContent.trim() === 'About'); if (!b) return false; b.click(); return true; })()`);
  await sleep(800);
  const about = await evalJs(cdp, `document.querySelector('main')?.textContent || ''`);
  const expectedVersion = JSON.parse(readFileSync("package.json", "utf-8")).version;
  record("About: version " + expectedVersion, about.includes(expectedVersion));
  record("About: build id", /wih-/.test(about));
  record("About: schema v1", about.includes("v1 (schemaVersion)"));

  console.log("phase: guide-me");
  await evalJs(cdp, `location.href = '/'`);
  await waitFor(cdp, `document.body?.textContent?.includes('Not sure what to do?')`);
  record("Guide Me entry on home", true);

  console.log("RESULTS_JSON=" + JSON.stringify(results));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("SMOKE ERROR:", e.message); process.exit(1); });
