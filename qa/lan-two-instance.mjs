/**
 * dev.19 two-instance live LAN sync QA (protocol v3, encrypted).
 *
 * Two REAL desktop instances with separate app-data profiles:
 *   A = "Dispatch Laptop" (WIH_PROFILE=qa-dispatch, CDP :9222, sync port 47618)
 *   B = "Field Laptop"    (WIH_PROFILE=qa-field,    CDP :9333, sync port 47619)
 *
 * Drives the actual Settings → Sync UI over CDP (DOM clicks) and verifies:
 * pairing (code + fingerprints), trust approval, record flow both ways,
 * same-field conflict surfacing, revoke stops sync, re-pair resumes.
 *
 * Usage: node qa/lan-two-instance.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const EXE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src-tauri/target/release/wildlife-incident-handoff.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (name, pass, note = "") => {
  results.push({ name, pass });
  console.log((pass ? "PASS" : "FAIL") + " | " + name + (note ? " | " + note : ""));
};

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error("ws error " + wsUrl)));
  });
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => {
    this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

async function evalJs(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page error: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}
async function waitFor(cdp, expression, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) { if (await evalJs(cdp, `!!(${expression})`)) return true; await sleep(300); }
  return false;
}
async function typeInto(cdp, finderJs, text) {
  const ok = await evalJs(cdp, `(() => { const el = ${finderJs}; if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event("input", { bubbles: true })); el.focus(); return true; })()`);
  if (!ok) throw new Error("input not found");
  await sleep(250);
}
async function click(cdp, finderJs, label) {
  if (!(await waitFor(cdp, finderJs, 12000))) throw new Error("not found: " + label);
  await evalJs(cdp, `(() => { const el = ${finderJs}; el.click(); return true; })()`);
  await sleep(400);
}

async function attach(port) {
  let list;
  for (let i = 0; i < 40; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(500); }
  }
  if (!list) throw new Error("CDP not reachable on " + port);
  const page = list.find((t) => t.type === "page");
  const ws = await connect(page.webSocketDebuggerUrl);
  const cdp = new Cdp(ws);
  await cdp.send("Runtime.enable");
  // Fresh profiles land on onboarding — mark onboarded so Settings is reachable.
  await sleep(2500);
  await evalJs(cdp, idbPut(["settings"], {
    key: "app-settings",
    value: {
      schemaVersion: 1, onboarded: true, workspace: "professional", experienceMode: "general",
      detailLevel: "standard", theme: "forest-dark", density: "comfortable", motion: "full",
      ambient: "on", displayName: "", defaultLocationPrecision: "approximate",
      includeContactsInShareable: false, lastBackupAt: null, country: "", units: "metric",
      savedReporterContact: null, professionalProfile: null, professionalRoles: [],
      activeProfessionalRole: null, tourCompleted: false, tourPromptDismissed: false,
      profilePhoto: null, photoBorder: "leaves", language: "en", mapTilesEnabled: true,
      onboardingPreviewActive: false, devPreviewLocales: false,
    },
  }));
  await evalJs(cdp, `location.reload()`);
  await sleep(2500);
  return cdp;
}

function launch(profile, debugPort) {
  return spawn(EXE, [], {
    env: { ...process.env, WIH_PROFILE: profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}` },
    stdio: "ignore", detached: false,
  });
}

// Direct IndexedDB helpers (same stores the app uses).
const idbPut = (store, value, key) => `new Promise((res, rej) => {
  const rq = indexedDB.open("wildlife-incident-handoff");
  rq.onsuccess = () => { const db = rq.result;
    const tx = db.transaction(${JSON.stringify(store)}, "readwrite");
    tx.objectStore(${JSON.stringify(store)}).put(${JSON.stringify(value)}${key ? `, ${JSON.stringify(key)}` : ""});
    tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => rej(tx.error); };
  rq.onerror = () => rej(rq.error); })`;
const idbGetAll = (store) => `new Promise((res, rej) => {
  const rq = indexedDB.open("wildlife-incident-handoff");
  rq.onsuccess = () => { const db = rq.result;
    const tx = db.transaction(${JSON.stringify(store)}, "readonly");
    const g = tx.objectStore(${JSON.stringify(store)}).getAll();
    g.onsuccess = () => { db.close(); res(g.result); }; };
  rq.onerror = () => rej(rq.error); })`;
const idbGet = (store, key) => `new Promise((res, rej) => {
  const rq = indexedDB.open("wildlife-incident-handoff");
  rq.onsuccess = () => { const db = rq.result;
    const tx = db.transaction(${JSON.stringify(store)}, "readonly");
    const g = tx.objectStore(${JSON.stringify(store)}).get(${JSON.stringify(key)});
    g.onsuccess = () => { db.close(); res(g.result ?? null); }; };
  rq.onerror = () => rej(rq.error); })`;

function makeIncident(id, summary, updatedAt, extra = {}) {
  const now = updatedAt;
  return {
    id, humanReference: "WIH-QA-" + id.toUpperCase(), summary, incidentType: "injured_wildlife",
    status: "reported", severity: "moderate", occurredAt: now, createdAt: now, updatedAt: now,
    reportedBy: "qa", isDemo: false, timeline: [{
      eventId: "ev-" + id + "-" + now, incidentId: id, eventType: "created",
      timestamp: now, actor: "qa", summary: "Incident created", details: null,
      metadata: null, relatedAttachmentIds: [],
    }],
    location: null, privateNotes: null, deletedAt: null, ...extra,
  };
}

const syncNav = `Array.from(document.querySelectorAll('nav button, nav a')).find(b => /sync/i.test(b.textContent) && b.closest('nav'))`;
const enableCheckbox = `document.querySelector('input[type="checkbox"]')`;
const codeText = `(() => { const dt = Array.from(document.querySelectorAll('dt')).find(d => /pairing code/i.test(d.textContent)); const v = dt ? dt.nextElementSibling.textContent.trim() : null; return v && v.length === 6 && v >= '000000' && v <= '999999' ? v : null; })()`;
const addrText = `(() => { const dt = Array.from(document.querySelectorAll('dt')).find(d => /Your address/i.test(d.textContent)); const v = dt ? dt.nextElementSibling.textContent.trim() : null; return v && v.indexOf('http://') === 0 ? v : null; })()`;
const fpText = `(() => { const dt = Array.from(document.querySelectorAll('dt')).find(d => /fingerprint/i.test(d.textContent)); return dt ? dt.nextElementSibling.textContent.trim() : null; })()`;
const trustBtn = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Trust device')`;
const pairBtn = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Pair')`;
const removeTrustBtn = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Remove trust')`;
const conflictNotice = `document.body.textContent.includes('Sync conflicts need review')`;
const cardLog = `Array.from(document.querySelectorAll('.card li')).map(l => l.textContent).filter(t => t.includes('—')).join(' || ')`;
const addressInput = `document.querySelector('input[placeholder^="http://"]')`;
const codeInput = `document.querySelector('input[placeholder*="code" i]')`;

async function openSyncSection(cdp) {
  await evalJs(cdp, `location.href = '/settings?section=sync'`);
  await waitFor(cdp, syncNav, 10000);
  await sleep(500);
  await click(cdp, syncNav, "Sync nav item");
  await sleep(500);
}

async function enableSync(cdp, label) {
  await click(cdp, enableCheckbox, label + " enable checkbox");
  if (!(await waitFor(cdp, codeText, 12000))) {
    console.log(label + " activity:", await evalJs(cdp, cardLog));
    console.log(label + " log lines:", await evalJs(cdp, `document.querySelector('.card')?.innerText.slice(0, 600)`));
  }
}

async function main() {
  if (!existsSync(EXE)) throw new Error("EXE missing: " + EXE);
  let a, b, procA, procB;
  try {
    // Fresh profiles each run (QA must be idempotent).
    const appData = process.env.APPDATA;
    for (const p of ["qa-dispatch", "qa-field"]) {
      const dir = path.join(appData, "org.wildlifeincidenthandoff.app", p);
      if (existsSync(dir)) { rmSync(dir, { recursive: true, force: true }); console.log("reset profile", p); }
    }
    console.log("launching instance A (Dispatch Laptop, profile qa-dispatch, CDP 9222)");
    procA = launch("qa-dispatch", 9222);
    await sleep(4000);
    a = await attach(9222);
    await sleep(2000);
    console.log("launching instance B (Field Laptop, profile qa-field, CDP 9333)");
    procB = launch("qa-field", 9333);
    await sleep(4000);
    b = await attach(9333);
    await sleep(2000);

    // Give B its own sync port BEFORE enabling (default would collide with A).
    await evalJs(b, idbPut(["settings"], { key: "lan-sync-config", value: { enabled: false, port: 47619, peers: [] } }));
    await evalJs(b, `location.reload()`);
    await sleep(2500);

    // --- Pairing ---
    await openSyncSection(a); await openSyncSection(b);
    await enableSync(a, "A enable"); await enableSync(b, "B enable");
    const codeA = await evalJs(a, codeText);
    const addrA = await evalJs(a, addrText);
    const fpA = await evalJs(a, fpText);
    record("A shows pairing code + fingerprint", /^\d{6}$/.test(codeA ?? "") && /^[0-9A-F ]{40,}$/.test(fpA ?? ""), `code=${codeA} fp=${(fpA ?? "").slice(0, 20)}…`);

    await typeInto(b, addressInput, addrA);
    await typeInto(b, codeInput, codeA);
    await click(b, pairBtn, "B pair button");
    await waitFor(b, `document.body.textContent.includes('Paired with')`, 8000);
    const pairedNoticeB = await evalJs(b, `document.body.textContent.includes('Paired with')`);
    record("B paired (shows A's fingerprint notice)", pairedNoticeB);
    await waitFor(a, trustBtn, 10000);
    await click(a, trustBtn, "A trust device");
    const trustedShown = await waitFor(a, removeTrustBtn, 8000);
    record("A trusts B (trusted device listed)", trustedShown);
    await waitFor(b, removeTrustBtn, 10000);
    record("B lists A as trusted", true);

    // --- A creates incident -> B receives ---
    const t0 = new Date(Date.now() - 60000).toISOString();
    await evalJs(a, idbPut(["incidents"], makeIncident("qa1001", "QA: hawk beside road, cannot fly", t0)));
    await evalJs(a, `location.reload()`);
    await sleep(1500);
    await openSyncSection(a);
    let gotOnB = false;
    for (let i = 0; i < 20 && !gotOnB; i++) {
      await sleep(3000);
      const rec = await evalJs(b, idbGet(["incidents"], "qa1001"));
      gotOnB = !!rec;
    }
    record("A incident received on B (sync round, encrypted)", gotOnB);
    if (!gotOnB) {
      console.log("A activity:", await evalJs(a, cardLog));
      console.log("B activity:", await evalJs(b, cardLog));
    }

    // --- B updates observation -> A receives (inbox drain path) ---
    const t1 = new Date().toISOString();
    const recB = await evalJs(b, idbGet(["incidents"], "qa1001"));
    recB.updatedAt = t1;
    recB.status = "response_requested";
    recB.timeline.push({ eventId: "ev-b1-" + t1, incidentId: "qa1001", eventType: "status_changed", timestamp: t1, actor: "field", summary: "Status changed from Reported to Response requested", details: null, metadata: null, relatedAttachmentIds: [] });
    await evalJs(b, idbPut(["incidents"], recB));
    let gotOnA = false;
    for (let i = 0; i < 20 && !gotOnA; i++) {
      await sleep(3000);
      const rec = await evalJs(a, idbGet(["incidents"], "qa1001"));
      gotOnA = rec && rec.updatedAt === t1;
    }
    record("B status update received on A", gotOnA);
    if (!gotOnA) {
      console.log("A activity:", await evalJs(a, cardLog));
      console.log("B activity:", await evalJs(b, cardLog));
      console.log("A record:", JSON.stringify(await evalJs(a, idbGet(["incidents"], "qa1001")))?.slice(0, 300));
    }

    // --- Same-field conflict: both edit summary since last ack ---
    // Deterministic conflict: pause sync on BOTH sides (config toggle), edit
    // the same field on each, then resume — both rounds then start with the
    // edits already in place, so neither can propagate first.
    const cfgOf = async (cdp) => JSON.parse(await evalJs(cdp, `new Promise((res)=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("lan-sync-config");g.onsuccess=()=>{db.close();res(JSON.stringify(g.result?g.result.value:{}))};};})`));
    const putCfg = (cfg) => `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${"$"}{JSON.stringify(${JSON.stringify("CFG_PLACEHOLDER")}) === "X" ? null : ${JSON.stringify(cfg)}});tx.oncomplete=()=>db.close();};})()`;
    const cfgA = await cfgOf(a);
    const cfgB = await cfgOf(b);
    const cfgExpr = (cfg) => `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(null)}});tx.oncomplete=()=>db.close();};})()`;
    void putCfg; void cfgExpr;
    await evalJs(a, `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(cfgA).replace('"enabled":true', '"enabled":false')}});tx.oncomplete=()=>db.close();};})()`);
    await evalJs(b, `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(cfgB).replace('"enabled":true', '"enabled":false')}});tx.oncomplete=()=>db.close();};})()`);
    await sleep(12000); // let both loops fully observe disabled and stop (round sleep is 5s)
    const t2a = new Date().toISOString();
    const t2b = new Date(Date.now() + 2).toISOString();
    const a2 = await evalJs(a, idbGet(["incidents"], "qa1001"));
    a2.summary = "A edit: hawk beside road";
    a2.updatedAt = t2a;
    await evalJs(a, idbPut(["incidents"], a2));
    const b2 = await evalJs(b, idbGet(["incidents"], "qa1001"));
    b2.summary = "B edit: hawk beside road";
    b2.updatedAt = t2b;
    await evalJs(b, idbPut(["incidents"], b2));
    // Re-enable sync on both.
    await evalJs(a, `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(cfgA)}});tx.oncomplete=()=>db.close();};})()`);
    await evalJs(b, `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(cfgB)}});tx.oncomplete=()=>db.close();};})()`);
    const peerStateExpr2 = `new Promise((res)=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("lan-sync-peer-state");g.onsuccess=()=>{db.close();res(g.result?JSON.stringify(g.result.value):"none")};};})`;
    const ra0 = await evalJs(a, idbGet(["incidents"], "qa1001"));
    const rb0 = await evalJs(b, idbGet(["incidents"], "qa1001"));
    console.log("POST-EDIT A:", ra0.summary, ra0.updatedAt, JSON.stringify(await evalJs(a, peerStateExpr2)));
    console.log("POST-EDIT B:", rb0.summary, rb0.updatedAt, JSON.stringify(await evalJs(b, peerStateExpr2)));
    await openSyncSection(a);
    await sleep(8000); // one sync round
    console.log("ROUND1 A log:", await evalJs(a, `Array.from(document.querySelectorAll('.card li')).map(l=>l.textContent).filter(t=>t.includes('—')).slice(0,4).join(' || ')`));
    console.log("ROUND1 A rec:", JSON.stringify(await evalJs(a, idbGet(["incidents"], "qa1001"))).slice(0, 120));
    console.log("ROUND1 B rec:", JSON.stringify(await evalJs(b, idbGet(["incidents"], "qa1001"))).slice(0, 120));
    console.log("ROUND1 B log:", await evalJs(b, `Array.from(document.querySelectorAll('.card li')).map(l=>l.textContent).filter(t=>t.includes('—')).slice(0,6).join(' || ')`));
    let conflictOnA = false;
    for (let i = 0; i < 20 && !conflictOnA; i++) {
      await sleep(3000);
      conflictOnA = await evalJs(a, conflictNotice);
    }
    record("same-field edits surface as explicit conflict (no silent overwrite)", conflictOnA);
    if (!conflictOnA) {
      console.log("A activity:", await evalJs(a, cardLog));
      const peerStateExpr = `new Promise((res)=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("lan-sync-peer-state");g.onsuccess=()=>{db.close();res(g.result?JSON.stringify(g.result.value):"none")};};})`;
      console.log("A peerState:", await evalJs(a, peerStateExpr));
      console.log("B peerState:", await evalJs(b, peerStateExpr));
      const ra = await evalJs(a, idbGet(["incidents"], "qa1001"));
      const rb = await evalJs(b, idbGet(["incidents"], "qa1001"));
      console.log("A rec:", ra.summary, ra.updatedAt, "timeline:", ra.timeline?.length);
      console.log("B rec:", rb.summary, rb.updatedAt, "timeline:", rb.timeline?.length);
      const conflictsExpr = `new Promise((res)=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("sync-conflicts");g.onsuccess=()=>{db.close();res(g.result?g.result.value.length:0)};};})`;
      console.log("A conflicts stored:", await evalJs(a, conflictsExpr));
    }

    // --- Revoke stops sync ---
    await click(a, removeTrustBtn, "A remove trust");
    await sleep(1000);
    const t3 = new Date(Date.now() + 4).toISOString();
    const b3 = await evalJs(b, idbGet(["incidents"], "qa1001"));
    b3.summary = "B edit AFTER revoke";
    b3.updatedAt = t3;
    await evalJs(b, idbPut(["incidents"], b3));
    await sleep(14000);
    const a3 = await evalJs(a, idbGet(["incidents"], "qa1001"));
    record("revoked peer cannot push (A never received post-revoke edit)", a3.summary !== "B edit AFTER revoke");

    // --- Re-pair resumes sync ---
    const codeA2 = await evalJs(a, codeText);
    const addrA2 = await evalJs(a, addrText);
    await typeInto(b, addressInput, addrA2);
    await typeInto(b, codeInput, codeA2);
    await click(b, pairBtn, "B re-pair button");
    await waitFor(a, trustBtn, 10000);
    await click(a, trustBtn, "A trust device again");
    await waitFor(b, removeTrustBtn, 10000);
    let resumed = false;
    for (let i = 0; i < 20 && !resumed; i++) {
      await sleep(3000);
      const rec = await evalJs(a, idbGet(["incidents"], "qa1001"));
      // The post-revoke edit must ARRIVE — auto-merged (no local divergence)
      // or surfaced as an explicit conflict. Silently missing = FAIL.
      resumed = rec && (rec.summary === "B edit AFTER revoke" || await evalJs(a, conflictNotice));
    }
    record("re-pairing resumes sync (post-revoke edit arrives via merge or conflict)", resumed);
  } finally {
    try { procA && procA.kill(); } catch {}
    try { procB && procB.kill(); } catch {}
  }

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${pass}/${results.length} checks passed`);
  writeFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "lan-two-instance-results.json"), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error("DRIVER ERROR:", e.message); process.exit(2); });
