const sleep = ms => new Promise(r => setTimeout(r, ms));
async function cdpFor(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const cdp = { ws };
  cdp.eval = async (expression) => {
    const mid = ++id;
    const res = await new Promise((resolve, reject) => {
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === mid) m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); };
      ws.send(JSON.stringify({ id: mid, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? "page error");
    return res.result?.value ?? null;
  };
  return cdp;
}
const [cmd, arg1, arg2] = process.argv.slice(2);
const port = cmd === "b" ? 9333 : 9222;
const cdp = await cdpFor(port);
if (cmd === "boot") {
  for (const port of [9222, 9333]) {
    const c = await cdpFor(port);
    await c.eval(`(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"app-settings",value:{schemaVersion:1,onboarded:true,workspace:"professional",experienceMode:"general",detailLevel:"standard",theme:"forest-dark",density:"comfortable",motion:"full",ambient:"on",displayName:"",defaultLocationPrecision:"approximate",includeContactsInShareable:false,lastBackupAt:null,country:"",units:"metric",savedReporterContact:null,professionalProfile:null,professionalRoles:[],activeProfessionalRole:null,tourCompleted:false,tourPromptDismissed:false,profilePhoto:null,photoBorder:"leaves",language:"en",mapTilesEnabled:true,onboardingPreviewActive:false,devPreviewLocales:false}});tx.oncomplete=()=>db.close();};})()`);
    await sleep(600); await c.eval(`location.reload()`); await sleep(2500);
  }
  console.log("booted"); process.exit(0);
}
if (cmd === "cfg") {
  // arg1 = json config to write on given instance
  for (const port of [9222, 9333]) {
    const c = await cdpFor(port);
    const cfg = JSON.parse(arg1);
    await c.eval(`(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"lan-sync-config",value:${JSON.stringify(cfg)}});tx.oncomplete=()=>db.close();};})()`);
  }
  console.log("config written"); process.exit(0);
}
if (cmd === "ui") {
  const c = await cdpFor(port);
  await c.eval(`location.href='/settings?section=sync'`); await sleep(1500);
  const btn = await c.eval(`(() => { const els = Array.from(document.querySelectorAll('nav button, nav a')); const b = els.find(x => x.textContent.trim() === 'Sync'); if (b) b.click(); return !!b; })()`);
  await sleep(800);
  console.log("clicked sync nav:", btn);
  const cb = await c.eval(`(() => { const el = document.querySelector('.card input[type="checkbox"]'); if (el && !el.checked) { el.click(); } return el ? el.checked : null; })()`);
  await sleep(1500);
  const text = await c.eval(`document.querySelector('.card')?.innerText ?? 'NO CARD'`);
  console.log("checkbox:", cb);
  console.log(text);
  process.exit(0);
}
if (cmd === "a" || cmd === "b") {
  await cdp.eval(`(async()=>{const rq=indexedDB.open("wildlife-incident-handoff");rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({key:"app-settings",value:{schemaVersion:1,onboarded:true,workspace:"professional",experienceMode:"general",detailLevel:"standard",theme:"forest-dark",density:"comfortable",motion:"full",ambient:"on",displayName:"",defaultLocationPrecision:"approximate",includeContactsInShareable:false,lastBackupAt:null,country:"",units:"metric",savedReporterContact:null,professionalProfile:null,professionalRoles:[],activeProfessionalRole:null,tourCompleted:false,tourPromptDismissed:false,profilePhoto:null,photoBorder:"leaves",language:"en",mapTilesEnabled:true,onboardingPreviewActive:false,devPreviewLocales:false}});tx.oncomplete=()=>db.close();};})()`);
  await sleep(800);
  await cdp.eval(`location.reload()`); await sleep(2500);
  await cdp.eval(`location.href='/settings?section=sync'`); await sleep(1200);
  const nav = await cdp.eval(`Array.from(document.querySelectorAll('nav button, nav a')).map(b=>b.textContent.trim()).join('|')`);
  console.log("nav:", nav);
  const card = await cdp.eval(`document.body.innerText.slice(0, 2500)`);
  console.log(card);
}
process.exit(0);
