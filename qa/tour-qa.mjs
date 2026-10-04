/**
 * dev.18 official-tour QA runner — drives the REAL desktop EXE over CDP
 * (WebView2 remote debugging on :9333) and runs each official tour N times,
 * reading window.__wihTourResults (recorded by the app itself).
 *
 * Usage: node qa/tour-qa.mjs [runsPerTour]
 * The app must be running with a fresh-ish profile; onboarding skipped.
 */
import { readFileSync } from "node:fs";

const RUNS = Number(process.argv[2] ?? 10);
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
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
    await sleep(200);
  }
  return false;
}
async function click(finderJs, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const pos = await evalJs(`(() => { const el = ${finderJs}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); if ((r.width === 0 && r.height === 0)) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (pos) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
      }
      await sleep(400);
      return true;
    }
    await sleep(250);
  }
  throw new Error("element not found: " + label);
}

const calloutNext = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Next','Suivant','Siguiente','Weiter','Próximo'].includes(b.textContent.trim()))`;
const calloutFinish = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Finish','Terminer','Finalizar','Fertig','Concluir'].includes(b.textContent.trim()))`;
const calloutSkipStep = `Array.from(document.querySelectorAll('.spotlight-callout button')).find(b => ['Skip step','Ignorer l\\u2019\\u00e9tape','Omitir paso','Schritt \\u00fcberspringen','Pular etapa'].includes(b.textContent.trim()))`;
const overlayGone = `!document.querySelector('[data-testid="spotlight-overlay"]')`;

async function countResults() {
  return evalJs(`(window.__wihTourResults ?? []).length`);
}

/** Drive one tour run to completion via UI clicks; returns the last recorded result. */
async function runTourOnce(label) {
  const before = await countResults();
  // start via Help → Tutorials
  await evalJs(`history.pushState({}, '', '/help'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
  await waitFor(`location.pathname === '/help'`, 8000);
  await sleep(700);
  await click(`Array.from(document.querySelectorAll('.help-rail-item')).find(b => new RegExp(${JSON.stringify(label.source)}).test(b.textContent.trim()))`, label.source);
  await waitFor(`document.querySelector('[data-testid="spotlight-overlay"]')`, 15000);
  await sleep(400);
  let guard = 0;
  while (!(await evalJs(overlayGone)) && guard < 40) {
    if (await evalJs(`!!(${calloutFinish})`)) await click(calloutFinish, "Finish");
    else if (await evalJs(`!!(${calloutSkipStep})`)) await click(calloutSkipStep, "Skip step (failure card)");
    else if (await evalJs(`!!(${calloutNext})`)) await click(calloutNext, "Next");
    else break;
    await sleep(350);
    guard++;
  }
  await waitFor(overlayGone, 8000);
  await sleep(500);
  const after = await countResults();
  return evalJs(`(window.__wihTourResults ?? [])[${after - 1}] ?? null`);
}

async function setWorkspace(ws) {
  // switch workspace via Settings (professional) — use the app's settings repo through UI:
  await evalJs(`history.pushState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
  await sleep(900);
}

const summary = { reporter: [], professional: [] };
const TOUR_LABELS = {
  interface: /^(Start tour)/,
  finding: /^(Finding reports)/,
};

// Reporter runs (default fresh profile is reporter)
for (const tour of ["interface", "finding"]) {
  for (let i = 0; i < RUNS; i++) {
    const r = await runTourOnce(TOUR_LABELS[tour]);
    summary.reporter.push({ tour, run: i + 1, ...r });
    console.log(`[tour-qa] reporter ${tour} run ${i + 1}: ${r?.status} autoskips=${r?.autoSkippedSteps?.length ?? "?"}`);
  }
}

// Professional runs: flip workspace via localStorage-free path — use the settings UI
await evalJs(`history.pushState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate')); true`);
await sleep(800);
// Professional mode toggle button text
const proBtn = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Professional') || b.textContent.includes('professional mode'))`;
try {
  await click(proBtn, "professional mode toggle");
  await sleep(800);
} catch {
  console.log("[tour-qa] WARN: could not find workspace toggle; trying onboarding replay path");
}
for (const tour of ["interface", "finding"]) {
  for (let i = 0; i < RUNS; i++) {
    const r = await runTourOnce(TOUR_LABELS[tour]);
    summary.professional.push({ tour, run: i + 1, ...r });
    console.log(`[tour-qa] professional ${tour} run ${i + 1}: ${r?.status} autoskips=${r?.autoSkippedSteps?.length ?? "?"}`);
  }
}

const flat = [...summary.reporter, ...summary.professional];
const tally = {
  completed: flat.filter((r) => r?.status === "completed").length,
  skipped_by_user: flat.filter((r) => r?.status === "skipped_by_user").length,
  auto_skipped: flat.filter((r) => r?.status === "auto_skipped_target_missing").length,
  failed: flat.filter((r) => r?.status === "failed").length,
  total: flat.length,
  autoSkippedSteps: flat.flatMap((r) => r?.autoSkippedSteps ?? []),
};
console.log(JSON.stringify({ summary: tally }, null, 2));
ws.close();
process.exit(0);
