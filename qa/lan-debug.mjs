/** Live debug: pair, sync, conflict — inspect ack state. Manual use only. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cdpFor(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  return { eval: async (expression) => {
    const mid = ++id;
    const res = await Promise.race([
      new Promise((resolve) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === mid) resolve(m.result); }; ws.send(JSON.stringify({ id: mid, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })); }),
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 15000)),
    ]);
    if (res.timeout) return "EVAL-TIMEOUT";
    if (res.exceptionDetails) return "PAGEERR:" + (res.exceptionDetails.exception?.description ?? "").slice(0, 120);
    return res.result?.value; } };
}
const ONBOARD = { schemaVersion: 1, onboarded: true, workspace: "professional", experienceMode: "general", detailLevel: "standard", theme: "forest-dark", density: "comfortable", motion: "full", ambient: "on", displayName: "", defaultLocationPrecision: "approximate", includeContactsInShareable: false, lastBackupAt: null, country: "", units: "metric", savedReporterContact: null, professionalProfile: null, professionalRoles: [], activeProfessionalRole: null, tourCompleted: false, tourPromptDismissed: false, profilePhoto: null, photoBorder: "leaves", language: "en", mapTilesEnabled: true, onboardingPreviewActive: false, devPreviewLocales: false };
const putSetting = (k, v) => `(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:${JSON.stringify(k)},value:${JSON.stringify(v)}});tx.oncomplete=()=>db.close();};})()`;
const getRec = `new Promise(res=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("incidents","readonly").objectStore("incidents").get("qa1001");g.onsuccess=()=>{db.close();res(g.result?(g.result.summary+" @ "+g.result.updatedAt.slice(11,19)+" st="+g.result.status):null)};};})`;
const getState = `new Promise(res=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("lan-sync-peer-state");g.onsuccess=()=>{db.close();res(g.result?JSON.stringify(g.result.value):null)};};})`;
const getConflicts = `new Promise(res=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const g=db.transaction("settings","readonly").objectStore("settings").get("sync-conflicts");g.onsuccess=()=>{db.close();res(g.result?g.result.value.length:0)};};})`;

const editQ = (patch) => `(() => new Promise((res, rej) => {
  const rq = indexedDB.open("wildlife-incident-handoff");
  rq.onsuccess = () => {
    const db = rq.result;
    const st = db.transaction("incidents", "readwrite").objectStore("incidents");
    const gq = st.get("qa1001");
    gq.onsuccess = () => {
      const rec = gq.result;
      Object.assign(rec, ${JSON.stringify(patch)});
      const pq = st.put(rec);
      pq.onsuccess = () => { db.close(); res(true); };
      pq.onerror = () => rej("put failed");
    };
  };
}))()`;

const a = await cdpFor(9222), b = await cdpFor(9333);
await a.eval(putSetting("app-settings", ONBOARD)); await sleep(400); await a.eval("location.reload()"); await sleep(2200);
await b.eval(putSetting("app-settings", ONBOARD)); await sleep(400); await b.eval("location.reload()"); await sleep(2200);
await b.eval(putSetting("lan-sync-config", { enabled: false, port: 47619, peers: [] })); await b.eval("location.reload()"); await sleep(2200);
for (const c of [a, b]) {
  await c.eval(`location.href='/settings?section=sync'`); await sleep(1100);
  await c.eval(`(() => { const x = Array.from(document.querySelectorAll('nav button, nav a')).find(x => x.textContent.trim()==='Sync'); x && x.click(); })()`); await sleep(500);
  await c.eval(`(() => { const el = document.querySelector('.card input[type="checkbox"]'); if (el && !el.checked) el.click(); })()`); await sleep(2200);
}
const codeA = await a.eval(`(() => { const dt = Array.from(document.querySelectorAll('dt')).find(d=>/pairing code/i.test(d.textContent)); return dt ? dt.nextElementSibling.textContent.trim() : null; })()`);
const addrA = await a.eval(`(() => { const dt = Array.from(document.querySelectorAll('dt')).find(d=>/Your address/i.test(d.textContent)); return dt ? dt.nextElementSibling.textContent.trim() : null; })()`);
await b.eval(`(() => { const el = document.querySelector('input[placeholder^="http://"]'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; s.call(el, ${JSON.stringify(addrA)}); el.dispatchEvent(new Event("input",{bubbles:true})); })()`);
await sleep(200);
await b.eval(`(() => { const el = document.querySelector('input[placeholder*="code" i]'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; s.call(el, ${JSON.stringify(codeA)}); el.dispatchEvent(new Event("input",{bubbles:true})); })()`);
await sleep(300);
await b.eval(`(() => { const btn = Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==='Pair'); btn && btn.click(); })()`);
await sleep(2500);
let trusted = false;
for (let i = 0; i < 20 && !trusted; i++) {
  await sleep(2000);
  trusted = await a.eval(`(() => { const x = Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==='Trust device'); if (x) { x.click(); return true; } return false; })()`);
}
console.log("A trusted B:", trusted);
await sleep(4000);

const t0 = new Date(Date.now() - 60000).toISOString();
const inc = { id: "qa1001", humanReference: "WIH-QA1001", summary: "QA hawk beside road", incidentType: "injured_wildlife", status: "reported", severity: "moderate", occurredAt: t0, createdAt: t0, updatedAt: t0, reportedBy: "qa", isDemo: false, timeline: [{ eventId: "ev1", incidentId: "qa1001", eventType: "created", timestamp: t0, actor: "qa", summary: "Incident created", details: null, metadata: null, relatedAttachmentIds: [] }], location: null, privateNotes: null, deletedAt: null };
await a.eval(`(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("incidents","readwrite");tx.objectStore("incidents").put(${JSON.stringify(inc)});tx.oncomplete=()=>db.close();};})()`);
await sleep(12000);
console.log("B has record:", await b.eval(getRec));

const t1 = new Date().toISOString();
await b.eval(editQ({ updatedAt: t1, status: "response_requested" }));
await sleep(12000);
console.log("A after B edit (expect response_requested):", await a.eval(getRec));

const t2 = new Date().toISOString();
await a.eval(editQ({ summary: "A edit: hawk", updatedAt: t2 }));
await b.eval(editQ({ summary: "B edit: hawk", updatedAt: t2 }));
await sleep(15000);
console.log("A conflicts:", await a.eval(getConflicts), "| A rec:", await a.eval(getRec), "| B rec:", await b.eval(getRec));
console.log("A state:", await a.eval(getState));
console.log("B state:", await b.eval(getState));
process.exit(0);
