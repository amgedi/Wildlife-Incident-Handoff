/** Home — normal-mode launch surface. No developer language. */
import { useEffect, useState } from "react";
import { useLauncher } from "../app/store";
import { api, type ReleaseCheck } from "../services/tauri";
import { IconFolder, IconRefresh, IconRocket, IconWrench } from "../components/icons";

export function Home() {
  const { identity, prefs, setView, updateAvailable } = useLauncher();
  const [launching, setLaunching] = useState(false);
  const [release, setRelease] = useState<ReleaseCheck | null>(null);

  useEffect(() => {
    if (prefs?.channel) void api.releaseCheck(prefs.channel).then(setRelease).catch(() => setRelease(null));
  }, [prefs?.channel]);

  const desktop = identity?.desktop;
  const ready = Boolean(desktop?.exeExists);
  const version = desktop?.version ?? identity?.version ?? "…";

  const launch = async () => {
    setLaunching(true);
    try { await api.launch(); } catch { /* surfaced via identity refresh below */ }
    setLaunching(false);
    void refresh();
  };
  const refresh = async () => { /* identity refresh hook */ };

  const status = ready
    ? { label: "Ready", cls: "" }
    : { label: "Not installed in this workspace", cls: "warn" };
  const updateState = updateAvailable
    ? { label: `${updateAvailable} available`, cls: "warn", pulse: true }
    : release?.status === "up-to-date"
      ? { label: "Up to date", cls: "", pulse: false }
      : release?.status === "available"
        ? { label: `${release.latestVersion} available`, cls: "warn", pulse: true }
        : null;

  return (
    <>
      <section className="launch-panel view-enter">
        <span className="eyebrow">Current release</span>
        <div className="launch-row">
          <span className="launch-version">{version}</span>
          <span className={`launch-status ${status.cls}`}>
            <span className="dot" /> {status.label}
          </span>
          {updateState && (
            <span className={`launch-status ${updateState.cls}`}>
              <span className={`dot${updateState.pulse ? " pulse" : ""}`} /> Update: {updateState.label}
            </span>
          )}
        </div>
        <div className="launch-row">
          <button className="primary-launch" disabled={!ready || launching} onClick={() => void launch()}>
            {launching ? "Launching…" : "Launch Wildlife Incident Handoff"}
          </button>
          {!ready && identity?.previous && (
            <button className="btn" style={{ marginTop: 18 }} onClick={() => void api.launchPrevious().catch(() => undefined)}>
              Launch previous verified build · {identity.previous.version}
            </button>
          )}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: "0.78rem", color: "var(--ink-faint)" }}>
          Local-first and private — your records stay on this device.
        </p>
      </section>

      {updateAvailable && (
        <section className="section view-enter">
          <div className="section-head"><span className="section-title">Update available</span></div>
          <div className="soft-card">
            <strong>Wildlife Incident Handoff {updateAvailable} is available</strong>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => setView("updates")}>What's new</button>
              <button className="btn" onClick={() => setView("updates")}>Download</button>
            </div>
          </div>
        </section>
      )}

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Quick actions</span></div>
        <div className="quick-grid">
          <button className="quick-tile" onClick={() => setView("updates")}><IconRefresh /> Check for updates</button>
          <button className="quick-tile" onClick={() => setView("diagnostics")}><IconWrench /> Repair &amp; diagnostics</button>
          <button className="quick-tile" onClick={() => void api.openReleaseFolder().catch(() => undefined)}><IconFolder /> Open release folder</button>
          <button className="quick-tile" onClick={() => setView("about")}><IconRocket /> About this app</button>
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">About this release</span></div>
        <div className="soft-card">
          <p style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.55, color: "var(--ink-soft)" }}>
            Wildlife Incident Handoff keeps incident details clear and traceable from the first report
            through every handoff. This launcher opens your installed Workbench and keeps it current.
          </p>
        </div>
      </section>
    </>
  );
}
