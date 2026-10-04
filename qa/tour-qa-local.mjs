/**
 * 0.3 tour QA — LOCAL runs of the RETARGETED tours (this working tree)
 * through the real SpotlightTour engine, driven over CDP.
 * Launches its own headless Chrome on :9333 (the production EXE on :9222
 * is left untouched). Runs every official tour N times per workspace with
 * window-size variation, fast-Next and Back-navigation variations.
 * Usage: node qa/tour-qa-local.mjs [runsPerTour]
 */
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = "http://localhost:5199/";
const PORT = 9333;
const RUNS = Number(process.argv[2] ?? 10);

const profile = mkdtempSync(join(tmpdir(), "wih-qa-"));
const chrome = execFile(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--window-size=1280,800",
  "--hide-scrollbars",
  APP,
]);
chrome.stderr.resume();

let list = null;
for (let i = 0; i < 40 && !list; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await new Promise(r => setTimeout(r, 500)); }
}
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

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("page error: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await evalJs(`!!(${expr})`)) return true;
    await sleep(150);
  }
  return false;
}
async function navigate(route) {
  await evalJs(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate')); true`);
  await sleep(600);
}
async function setViewport(w, h) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 0, mobile: false });
  await sleep(300);
}
async function click(finderJs, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const pos = await evalJs(`(() => {
      const el = ${finderJs}; if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      // the help rail can leave the item below the fold — bring the window
      // and every scrollable ancestor along until the center is on-screen
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (a.scrollHeight > a.clientHeight + 4) a.scrollTop = a.scrollTop + (el.getBoundingClientRect().top - a.clientHeight / 2);
      }
      const r = el.getBoundingClientRect();
      if (r.top < 0) window.scrollBy(0, r.top);
      if (r.bottom > innerHeight) window.scrollBy(0, r.bottom - innerHeight);
      const r2 = el.getBoundingClientRect();
      if ((r2.width === 0 && r2.height === 0) || r2.top < 0 || r2.bottom > innerHeight + 1) {
        el.click(); return "js";
      }
      return { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
    })()`);
    if (pos) {
      if (pos !== "js") {
        for (const type of ["mousePressed", "mouseReleased"]) {
          await send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
        }
      }
      await sleep(300);
      return true;
    }
    await sleep(200);
  }
  throw new Error("element not found: " + label);
}

const calloutNext = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Next','Suivant','Siguiente','Weiter','Próximo','Próxima'].includes(b.textContent.trim()))`;
const calloutBack = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Back','Retour','Atrás','Zurück','Voltar'].includes(b.textContent.trim()))`;
const calloutFinish = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Finish','Terminer','Finalizar','Fertig','Concluir'].includes(b.textContent.trim()))`;
const calloutSkipStep = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Skip step','Ignorer l\\u2019\\u00e9tape','Omitir paso','Schritt \\u00fcberspringen','Pular etapa'].includes(b.textContent.trim()))`;
const overlayGone = `!document.querySelector('[data-testid="spotlight-overlay"]')`;

async function countResults() {
  return evalJs(`(window.__wihTourResults ?? []).length`);
}
async function runTourOnce(launchFn, mode = "fast") {
  const before = await countResults();
  await launchFn();
  const appeared = await waitFor(`document.querySelector('[data-testid="spotlight-overlay"]')`, 15000);
  if (!appeared) {
    const why = await evalJs(`(() => {
      const btn = Array.from(document.querySelectorAll('.help-rail-item')).find(b => /Finding reports|Start tour|Open examples/.test(b.textContent));
      if (!btn) return 'button gone';
      const r = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return 'at-point=' + (top ? top.tagName + '.' + top.className : 'null') + ' rect=' + JSON.stringify({ t: r.top, b: r.bottom, l: r.left });
    })()`);
    console.log(`[debug] overlay never appeared; path=${await evalJs("location.pathname")} ${why}`);
    return null;
  }
  await sleep(300);
  let guard = 0;
  let didBack = false;
  while (!(await evalJs(overlayGone)) && guard < 60) {
    if (mode === "back" && !didBack && (await evalJs(`!!(${calloutBack})`))) {
      await click(calloutBack, "Back");
      didBack = true;
      await sleep(300);
      continue;
    }
    if (await evalJs(`!!(${calloutFinish})`)) await click(calloutFinish, "Finish");
    else if (await evalJs(`!!(${calloutSkipStep})`)) await click(calloutSkipStep, "Skip step (failure card)");
    else if (await evalJs(`!!(${calloutNext})`)) await click(calloutNext, "Next");
    else break;
    await sleep(mode === "fast" ? 100 : 300);
    guard++;
  }
  await waitFor(overlayGone, 8000);
  await sleep(400);
  const after = await countResults();
  return evalJs(`(window.__wihTourResults ?? [])[${after - 1}] ?? null`);
}

// ---------- make sure the app actually loaded (retry navigation) ----------
await send("Runtime.enable");
ws._console = [];
const _origOnMessage = ws.onmessage;
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
    ws._console.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  }
  _origOnMessage(ev);
};
await send("Page.enable");
for (let i = 0; i < 5; i++) {
  await send("Page.navigate", { url: APP });
  await sleep(2000);
  if (await evalJs(`location.origin === 'http://localhost:5199' && !!document.querySelector('#root, #app, main, body *')`)) break;
}

// ---------- onboarding (fresh profile) ----------
await sleep(1500);
if (await waitFor(`location.pathname === '/onboarding'`, 10000)) {
  await sleep(500);
  const skip = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip setup')`;
  if (await waitFor(skip, 6000)) {
    await click(skip, "Skip setup");
    await sleep(800);
  }
}
console.log("[setup] path after onboarding:", await evalJs("location.pathname"));
// dismiss the "New here?" tour prompt (it overlays Home and swallows clicks)
await sleep(1500);
const later = `Array.from(document.querySelectorAll('.dialog-backdrop button')).find(b => b.textContent.trim() === 'Maybe later')`;
if (await waitFor(later, 4000)) {
  await click(later, "Maybe later");
  await sleep(500);
}

// ---------- launchers ----------
async function toHelp() { await navigate("/help"); await sleep(400); }
const launchInterface = async () => {
  await toHelp();
  await click(`Array.from(document.querySelectorAll('.help-rail-item')).find(b => /^Start tour/.test(b.textContent.trim()))`, "Start tour");
};
const launchFinding = async () => {
  await toHelp();
  await click(`Array.from(document.querySelectorAll('.help-rail-item')).find(b => /^Finding reports/.test(b.textContent.trim()))`, "Finding reports");
};
const launchDemo = async () => {
  await toHelp();
  await click(`Array.from(document.querySelectorAll('.help-rail-item')).find(b => /Open examples/i.test(b.textContent))`, "Open examples rail item");
  await sleep(700);
  await click(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Open example')`, "Open example");
};

const VIEWPORTS = [[1280, 800], [1024, 700]];
const tally = { completed: 0, skipped_by_user: 0, auto_skipped_target_missing: 0, failed: 0, total: 0 };
const failures = [];
async function runSeries(name, launch, runs) {
  for (let i = 0; i < runs; i++) {
    const mode = i % 5 === 3 ? "back" : "fast";
    await setViewport(...VIEWPORTS[i % 2]);
    const r = await runTourOnce(launch, mode);
    tally[r?.status ?? "failed"] = (tally[r?.status ?? "failed"] ?? 0) + 1;
    tally.total++;
    const line = `[run] ${name} #${i + 1} (${mode}, ${VIEWPORTS[i % 2].join("x")}): ${r?.status} autoskips=${JSON.stringify(r?.autoSkippedSteps ?? [])} steps=${r?.totalSteps}`;
    console.log(line);
    if (r?.status !== "completed") failures.push(line);
    await navigate("/");
    await sleep(300);
  }
}

// ---------- reporter runs ----------
console.log("[phase] REPORTER workspace");
await runSeries("reporter/interface", launchInterface, RUNS);
await runSeries("reporter/finding-reports", launchFinding, RUNS);
await runSeries("reporter/demo-incident", launchDemo, RUNS);

// ---------- flip to professional via the app's settings store, reload ----------
await evalJs(`(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('wildlife-incident-handoff'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rec = await new Promise((res) => { const rq = db.transaction('settings').objectStore('settings').get('app-settings'); rq.onsuccess = () => res(rq.result); });
  rec.value = { ...rec.value, workspace: 'professional' };
  await new Promise((res) => { const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put(rec); tx.oncomplete = res; });
  return true;
})()`);
await evalJs(`location.reload()`);
await sleep(2500);
const isPro = await evalJs(`!!document.querySelector('[data-tour-id="hero-dashboard"]') || !!document.querySelector('.ops-topbar')`);
console.log(`[phase] PROFESSIONAL workspace (flipped: ${isPro})`);
await runSeries("pro/interface", launchInterface, RUNS);
await runSeries("pro/finding-reports", launchFinding, RUNS);
await runSeries("pro/demo-incident", launchDemo, RUNS);

console.log(JSON.stringify({ tally, failures }, null, 2));
ws.close();
chrome.kill();
process.exit(failures.length === 0 ? 0 : 2);
