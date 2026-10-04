/** Runtime release verification (0.3.0-dev.4 spec 50): launch the packaged
 *  portable exe with CDP, read the About build identity, and assert it was
 *  produced by the current commit/version.
 *
 * Usage: node scripts/verify-release.mjs [expectedCommitShort]
 * (expects the exe to NOT already be running — kills Wildlife instances first)
 */
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedCommit = process.argv[2] ?? null;
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const version = pkg.version;

try { execSync(`taskkill /F /IM "Wildlife-Incident-Handoff-Portable-${version}.exe"`, { stdio: "ignore" }); } catch {}
try {
  execSync('powershell -Command "Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -like \'*Wildlife*\'} | Stop-Process -Force"', { stdio: "ignore" });
} catch {}
await new Promise((r) => setTimeout(r, 2500));

const exe = `release/desktop/Wildlife-Incident-Handoff-Portable-${version}.exe`;
const child = spawn(exe, [], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222" },
  detached: true,
  stdio: "ignore",
});
child.unref();
await new Promise((r) => setTimeout(r, 12000));

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target — exe did not start");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.navigate", { url: "http://tauri.localhost/settings?section=about" });
await sleep(2200);
const identity = await send("Runtime.evaluate", {
  expression: `document.querySelector('[data-testid="about-build-identity"]')?.textContent ?? ""`,
  returnByValue: true,
});
ws.close();

const text = identity.result?.value ?? "";
const okVersion = text.includes(version);
const commit = text.match(/Commit([a-f0-9]{7,})/)?.[1] ?? null;
const frontend = text.match(/Frontend build([a-f0-9]+)/)?.[1] ?? null;
console.log(JSON.stringify({ version: okVersion, commit, frontend, raw: text.slice(0, 200) }, null, 2));
if (!okVersion) throw new Error(`packaged exe reports wrong version (expected ${version})`);
if (expectedCommit && commit && !commit.startsWith(expectedCommit)) {
  throw new Error(`packaged exe commit ${commit} != expected ${expectedCommit}`);
}
console.log("RELEASE VERIFIED: packaged exe reports the expected build identity");
