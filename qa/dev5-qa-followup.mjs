/** Follow-up checks for the three dev5-qa failures (timing-sensitive). */
const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
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
await send("Page.navigate", { url: "http://tauri.localhost/network?view=map" });
await sleep(3500);

const recent = await ev(`(() => {
  const cands = Array.from(document.querySelectorAll(".sidebar .nav-sep, .sidebar .sidebar-section-label")).map(el => ({
    text: el.textContent.trim().slice(0, 20),
    top: Math.round(el.getBoundingClientRect().top),
  }));
  return JSON.stringify(cands);
})()`);
console.log("sidebar labels:", recent);

const canvas = await ev(`(() => {
  const c = document.querySelector("canvas");
  return { canvas: !!c, w: c?.width ?? 0 };
})()`);
console.log("canvas:", JSON.stringify(canvas));

const measure = await ev(`(() => {
  const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim().toLowerCase().includes("measure"));
  if (!b) return "no button";
  b.click();
  return "clicked";
})()`);
await sleep(900);
const panel = await ev(`JSON.stringify({
  panel: !!document.querySelector(".mv4-measure"),
  text: document.querySelector(".mv4-measure")?.textContent?.trim().slice(0, 80) ?? null,
  cursor: document.querySelector(".maplibregl-canvas")?.style?.cursor ?? null,
  clicked: "${measure}",
})`);
console.log("measure panel:", panel);
ws.close();
process.exit(0);
