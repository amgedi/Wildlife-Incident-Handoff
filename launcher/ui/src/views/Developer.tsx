/** Developer Tools — workspace mode: source status, builds, release packaging. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLauncher } from "../app/store";
import { api, type BuildStatus, type GitUpdateInfo } from "../services/tauri";
import { IconFolder, IconGlobe, IconRefresh, IconRocket, IconTerminal } from "../components/icons";

const FRESH_LABEL: Record<string, [string, string]> = {
  "current": ["CURRENT", "state-ok"],
  "source-changed": ["SOURCE CHANGED", "state-warn"],
  "source-dirty": ["SOURCE DIRTY", "state-warn"],
  "version-mismatch": ["VERSION MISMATCH", "state-err"],
  "desktop-missing": ["DESKTOP MISSING", "state-warn"],
  "not-git": ["NOT A GIT CHECKOUT", "state-warn"],
};

export function Developer() {
  const { identity, refreshIdentity } = useLauncher();
  const [build, setBuild] = useState<BuildStatus | null>(null);
  const [gitUpdate, setGitUpdate] = useState<GitUpdateInfo | null>(null);
  const [launchIntent, setLaunchIntent] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => { await refreshIdentity(); }, [refreshIdentity]);

  useEffect(() => {
    if (!build?.running) return;
    pollRef.current = window.setInterval(async () => {
      const st = await api.buildStatus();
      setBuild(st);
      if (!st.running) {
        if (st.done && launchIntent) {
          setLaunchIntent(false);
          setTimeout(() => void api.launch().catch(() => undefined), 400);
        }
        await refresh();
      }
    }, 400);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [build?.running, launchIntent, refresh]);

  const startBuild = async (andLaunch: boolean) => {
    try {
      await api.build();
      setLaunchIntent(andLaunch);
      setBuild(await api.buildStatus());
      setLogOpen(true);
    } catch { /* already running */ }
  };

  const id = identity;
  if (!id) return null;
  const [freshLabel, freshCls] = FRESH_LABEL[id.freshness] ?? [id.freshness.toUpperCase(), "state-warn"];

  return (
    <>
      <section className="section view-enter">
        <div className="section-head">
          <span className="section-title">Source status</span>
          <span className={freshCls} style={{ fontSize: "0.74rem", fontWeight: 700 }}>{freshLabel}</span>
        </div>
        <div className="soft-card">
          <div className="kv"><span className="k">Source version</span><span className="v">{id.version} · {id.commit}</span></div>
          <div className="kv"><span className="k">Desktop</span><span className="v">{id.desktop ? `${id.desktop.version} @ ${id.desktop.commit || "?"}` : "not built"}</span></div>
          <div className="kv"><span className="k">Web</span><span className="v">{id.desktop?.manifestOk ? `built · ${id.desktop.webBuildId.slice(0, 10)}` : "not packaged"}</span></div>
          <div className="kv"><span className="k">Parity</span><span className="v">{id.freshnessDetail}</span></div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => void refresh()}><IconRefresh size={13} /> Refresh</button>
            <button className="btn ghost" onClick={async () => { setGitUpdate(await api.gitUpdateCheck()); }}>
              <IconGlobe size={13} /> Check Git remote
            </button>
          </div>
          {gitUpdate && (
            <p style={{ margin: "10px 0 0", fontSize: "0.78rem", color: "var(--ink-soft)" }}>
              <strong>{gitUpdate.status}</strong> — {gitUpdate.detail}
              {gitUpdate.remoteCommit && <> (local {gitUpdate.localCommit} → remote {gitUpdate.remoteCommit})</>}
            </p>
          )}
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Build</span></div>
        <div className="soft-card">
          <div className="btn-row">
            <button className="btn" disabled={build?.running ?? false} onClick={() => void startBuild(false)}>Build current Workbench</button>
            <button className="btn" disabled={build?.running ?? false} onClick={() => void startBuild(true)}><IconRocket size={13} /> Build &amp; Launch</button>
            <button className="btn ghost" onClick={() => void api.webPreview().catch(() => undefined)}><IconGlobe size={13} /> Web Preview</button>
          </div>
          {build && (build.running || build.done != null) && (
            <div className="pipeline" style={{ marginTop: 14 }}>
              {build.stages.map((s, i) => {
                const cls = build.running || build.done == null
                  ? i < build.stageIndex ? "done" : i === build.stageIndex ? "active" : ""
                  : build.done
                    ? i <= build.stageIndex ? "done" : ""
                    : i === build.stageIndex ? "failed" : i < build.stageIndex ? "done" : "";
                return (
                  <div key={s} className={`pipe-step ${cls}`}>
                    <span className="dot" /> {s}
                  </div>
                );
              })}
            </div>
          )}
          {build && build.lines.length > 0 && (
            <>
              <button className="btn ghost" style={{ marginTop: 10 }} aria-expanded={logOpen} onClick={() => setLogOpen((v) => !v)}>
                <IconTerminal size={13} /> {logOpen ? "Hide" : "Show"} build log
              </button>
              {logOpen && <div className="log-view" style={{ marginTop: 8 }}>{build.lines.slice(-14).join("\n")}</div>}
            </>
          )}
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Release packaging</span></div>
        <div className="soft-card">
          <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
            Canonical pipeline: <code>npm run release:all</code> — builds, verifies identity parity,
            packages installer/portable/web, writes the manifest + checksums into release/current.
          </p>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => void api.openReleaseFolder().catch(() => undefined)}>
              <IconFolder size={13} /> Open release folder
            </button>
            {id.previous && (
              <button className="btn ghost" onClick={() => void api.launchPrevious().catch(() => undefined)}>
                Launch previous verified build · {id.previous.version}
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
