/** Updates — dedicated view with real update states + channel choice. */
import { useCallback, useEffect, useState } from "react";
import { useLauncher } from "../app/store";
import { api, type ReleaseCheck } from "../services/tauri";
import { IconClock, IconDownload, IconGlobe, IconRefresh } from "../components/icons";

const STATE_TEXT: Record<ReleaseCheck["status"], { title: string; cls: string }> = {
  "up-to-date": { title: "You're up to date", cls: "" },
  "available": { title: "Update available", cls: "warn" },
  "offline": { title: "You're offline", cls: "warn" },
  "unavailable": { title: "Release service unavailable", cls: "warn" },
  "error": { title: "Couldn't check for updates", cls: "err" },
};

export function Updates() {
  const { prefs, updatePrefs, updateAvailable } = useLauncher();
  const [check, setCheck] = useState<ReleaseCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const run = useCallback(async (channel: "tester" | "stable") => {
    setChecking(true);
    try {
      const r = await api.releaseCheck(channel);
      setCheck(r);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setCheck({ status: "error", channel, currentVersion: "", latestVersion: null, notesUrl: null, detail: "Check failed." });
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    if (prefs?.channel) void run(prefs.channel);
  }, [prefs?.channel, run]);

  const channel = prefs?.channel ?? "tester";
  const state = STATE_TEXT[check?.status ?? "error"];
  const effectiveAvailable = check?.status === "available" ? check.latestVersion : updateAvailable;

  return (
    <>
      <section className="launch-panel view-enter">
        <span className="eyebrow">Updates</span>
        <div className="launch-row">
          <div style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-faint)" }}>Current version</span>
            <span className="launch-version" style={{ fontSize: "1.6rem" }}>{check?.currentVersion || "…"}</span>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-faint)" }}>Channel</span>
            <div className="btn-row">
              {(["tester", "stable"] as const).map((c) => (
                <button
                  key={c}
                  className={`btn${channel === c ? "" : " ghost"}`}
                  aria-pressed={channel === c}
                  onClick={() => void updatePrefs({ channel: c })}
                >
                  {c === "tester" ? "Tester (RC builds)" : "Stable"}
                </button>
              ))}
            </div>
          </div>
          <span className={`launch-status ${state.cls}`}>
            <span className={`dot${checking ? " pulse" : ""}`} />
            {checking ? "Checking…" : state.title}
          </span>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={checking} onClick={() => void run(channel)}>
            <IconRefresh size={13} /> Check now
          </button>
          {check?.notesUrl && (
            <button className="btn ghost" onClick={() => window.open(check.notesUrl!, "_blank")}>
              Release notes
            </button>
          )}
          {effectiveAvailable && (
            <button className="btn" onClick={() => window.open(check?.notesUrl ?? "https://github.com/amgedi/Wildlife-Incident-Handoff/releases", "_blank")}>
              <IconDownload size={13} /> Get the update
            </button>
          )}
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Status</span></div>
        <div className="soft-card">
          {check?.detail ? (
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-soft)" }}>{check.detail}</p>
          ) : (
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-faint)" }}>
              The launcher checks this device's installed release against the
              {channel === "tester" ? " tester (RC)" : " stable"} channel.
            </p>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "0.76rem", color: "var(--ink-faint)" }}>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><IconClock size={13} /> Last checked: {lastChecked ?? "not yet"}</span>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><IconGlobe size={13} /> Updates come from the official GitHub releases</span>
          </div>
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">What's new</span></div>
        <div className="soft-card">
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-soft)" }}>
            0.3.0-rc.2 — new companion launcher, responsive windowing fixes, and
            the first signed auto-update infrastructure. See the release notes for the full list.
          </p>
        </div>
      </section>
    </>
  );
}
