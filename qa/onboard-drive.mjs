/** Drive onboarding in the RUNNING desktop EXE (:9222) via DOM clicks. */
const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable");
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 0; i < 20; i++) {
  const state = await ev(`JSON.stringify({loc:location.href, btns:Array.from(document.querySelectorAll("button")).map(b=>b.textContent.trim()).filter(Boolean).slice(0,14)})`);
  const s = JSON.parse(state);
  console.log(i, s.loc, "|", s.btns.join(" / "));
  if (!s.loc.includes("onboarding")) break;
  const clicked = await ev(`(()=>{const b=Array.from(document.querySelectorAll("button")).find(b=>(b.textContent.trim()==="Next"||b.textContent.trim()==="Continue"||b.textContent.trim()==="Get started"||b.textContent.trim()==="Finish")&&!b.disabled); if(b){b.click();return b.textContent.trim();} const sk=Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Skip setup"); if(sk){sk.click();return "skip";} return null;})()`);
  console.log("  clicked:", clicked);
  await sleep(900);
  if (!clicked) { console.log("no clickable button; breaking"); break; }
}
console.log("final:", await ev("location.href"));
ws.close();
process.exit(0);
