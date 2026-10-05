/** Diagnostics — structured, copyable, secret-free. */
import { useCallback, useEffect, useState } from "react";
import { api, type Diagnostics as Diag } from "../services/tauri";
import { IconCopy, IconFolder } from "../components/icons";

export function Diagnostics() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setDiag(await api.diagnostics()); setError(null); }
    catch (e) { setError(String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = async () => {
    if (!diag) return;
    const text = [
      `Launcher: ${diag.launcherVersion}`,
      `App version: ${diag.sourceVersion}`,
      `App commit: ${diag.sourceCommit}`,
      `Workspace dirty: ${diag.gitDirty ? "yes" : "no"}`,
      `Desktop build: ${diag.desktopVersion} @ ${diag.desktopCommit || "—"}`,
      `Desktop path: ${diag.desktopPath}`,
      `Web build id: ${diag.webBuildId || "—"}`,
      `Release folder: ${diag.releaseCurrentPath}`,
      `Git remote: ${(diag.gitRemote || "none configured").split("\n")[0]}`,
      `Last build: ${diag.lastBuildResult}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* denied */ }
  };

  if (error) return <div className="soft-card view-enter"><p className="state-err">{error}</p></div>;
  if (!diag) return null;

  const rows: Array<[string, string]> = [
    ["Launcher version", diag.launcherVersion],
    ["App version", diag.sourceVersion],
    ["App commit", diag.sourceCommit || "—"],
    ["Workspace state", diag.gitDirty ? "uncommitted changes" : "clean"],
    ["Desktop build", `${diag.desktopVersion} @ ${diag.desktopCommit || "—"}`],
    ["Desktop path", diag.desktopPath],
    ["Web build id", diag.webBuildId || "—"],
    ["Release folder", diag.releaseCurrentPath],
    ["Update endpoint", "GitHub releases (amgedi/Wildlife-Incident-Handoff)"],
    ["Last build", diag.lastBuildResult],
  ];

  return (
    <>
      <section className="section view-enter">
        <div className="section-head">
          <span className="section-title">Diagnostics</span>
          <div className="btn-row">
            <button className="btn" onClick={() => void copy()}><IconCopy size={13} /> {copied ? "Copied ✓" : "Copy diagnostics"}</button>
            <button className="btn ghost" onClick={() => void api.openLogsFolder().catch(() => undefined)}>Open logs</button>
            <button className="btn ghost" onClick={() => void api.openReleaseFolder().catch(() => undefined)}><IconFolder size={13} /> Open release folder</button>
          </div>
        </div>
        <div className="soft-card">
          {rows.map(([k, v]) => (
            <div className="kv" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
          <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--ink-faint)" }}>
            Diagnostics contain version and build information only — never incident data, coordinates, or keys.
          </p>
        </div>
      </section>
    </>
  );
}
