/**
 * 0.3 tour QA — drives the RUNNING desktop EXE over WebView2 CDP :9222.
 * (tour-qa.mjs pattern, retargeted: port 9222, plus 0.3 target probes,
 * window-size variation, fast-next and Back-navigation variations.)
 * Does NOT kill or relaunch the app.
 * Usage: node qa/tour-qa-9222.mjs [runsPerTour]
 */
const PORT = 9222;
const RUNS = Number(process.argv[2] ?? 10);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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
    const pos = await evalJs(`(() => { const el = ${finderJs}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); if ((r.width === 0 && r.height === 0)) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (pos) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
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

/** Drive one tour run. mode: "fast" (minimal sleeps) | "back" (one Back mid-tour). */
async function runTourOnce(launchFn, mode = "fast") {
  const before = await countResults();
  await launchFn();
  await waitFor(`document.querySelector('[data-testid="spotlight-overlay"]')`, 15000);
  await sleep(300);
  let guard = 0;
  let didBack = false;
  while (!(await evalJs(overlayGone)) && guard < 60) {
    if (mode === "back" && !didBack && (await evalJs(`!!(${calloutBack})`))) {
      await click(calloutBack, "Back");
      didBack = true;
      await sleep(250);
      continue;
    }
    if (await evalJs(`!!(${calloutFinish})`)) await click(calloutFinish, "Finish");
    else if (await evalJs(`!!(${calloutSkipStep})`)) await click(calloutSkipStep, "Skip step (failure card)");
    else if (await evalJs(`!!(${calloutNext})`)) await click(calloutNext, "Next");
    else break;
    await sleep(mode === "fast" ? 120 : 300);
    guard++;
  }
  await waitFor(overlayGone, 8000);
  await sleep(400);
  const after = await countResults();
  return evalJs(`(window.__wihTourResults ?? [])[${after - 1}] ?? null`);
}

// ---------- launchers (Help page rail, like a real user) ----------
async function toHelp() {
  await navigate("/help");
  await sleep(400);
}
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
  await click(`Array.from(document.querySelectorAll('.help-rail-item')).find(b => /examples/i.test(b.textContent))`, "Examples rail item");
  await sleep(700);
  await click(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Open example')`, "Open example");
};

// ---------- Phase A: probe every retargeted step's SEMANTIC target ----------
const VIEWPORTS = [[1280, 800], [1100, 720]];
const PROBES = [
  ["dashboard greeting", "/network", `.ops-topbar h1`],
  ["needs-attention band", "/network", `.attn-band`],
  ["response flow rail", "/network", `.rflow-rail`],
  ["rflow stage buttons", "/network", `.rflow-stage[data-stage]`],
  ["incidents summary band", "/incidents", `[data-testid="summary-band"]`],
  ["incidents search", "/incidents", `[data-tour-id="incident-search"]`],
  ["incidents filters button", "/incidents", `[data-tour-id="filters-button"]`],
  ["incidents view-mode segmented", "/incidents", `.segmented[role="group"][aria-label] button`],
  ["incident header", "/incidents", null],
  ["settings devices", "/settings?section=devices", `[data-testid="device-this-device"]`],
  ["settings trusted", "/settings?section=devices", `[data-testid="device-trusted"]`],
];
console.log("[probe] checking 0.3 semantic targets in the running EXE");
const probeFailures = [];
for (let i = 0; i < PROBES.length; i++) {
  const [label, route, sel] = PROBES[i];
  await setViewport(...VIEWPORTS[i % 2]);
  await navigate(route);
  await sleep(700);
  if (sel === null) { console.log(`[probe] ${label}: (route-only) ok`); continue; }
  const ok = await waitFor(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; })()`, 6000);
  console.log(`[probe] ${label} @ ${route}: ${ok ? "FOUND" : "MISSING"}`);
  if (!ok) probeFailures.push(`${label} @ ${route}`);
}

// detect workspace
await navigate("/");
await sleep(600);
const isPro = await evalJs(`!!document.querySelector('[data-tour-id="hero-dashboard"]') || !!document.querySelector('.ops-topbar')`);
const guideOnHome = await evalJs(`!!document.querySelector('[data-tour-id="guide-me-card"]')`);
console.log(`[probe] workspace: ${isPro ? "professional" : "reporter"}; guide-me-card on home: ${guideOnHome}`);

// ---------- Phase B: run the bundled official tours ----------
const tally = { completed: 0, skipped_by_user: 0, auto_skipped_target_missing: 0, failed: 0, total: 0 };
const failures = [];
async function runSeries(name, launch, runs) {
  for (let i = 0; i < runs; i++) {
    const mode = i % 5 === 3 ? "back" : "fast";
    await setViewport(...VIEWPORTS[i % 2]);
    const r = await runTourOnce(launch, mode);
    tally[r?.status ?? "failed"] = (tally[r?.status ?? "failed"] ?? 0) + 1;
    tally.total++;
    const line = `[run] ${name} #${i + 1} (${mode}, ${VIEWPORTS[i % 2].join("x")}): ${r?.status} autoskips=${JSON.stringify(r?.autoSkippedSteps ?? [])}`;
    console.log(line);
    if (r?.status !== "completed") failures.push(line);
    await navigate("/");
    await sleep(300);
  }
}
await runSeries("interface", launchInterface, RUNS);
await runSeries("finding-reports", launchFinding, RUNS);
await runSeries("demo-incident", launchDemo, RUNS);

console.log(JSON.stringify({ probes: { failures: probeFailures }, workspace: isPro ? "professional" : "reporter", tally, failures }, null, 2));
ws.close();
process.exit(failures.length === 0 && probeFailures.length === 0 ? 0 : 2);
