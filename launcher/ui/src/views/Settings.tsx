/** Settings — appearance gallery + real launcher preferences. */
import { useLauncher } from "../app/store";
import { THEMES } from "../themes";
import type { Prefs } from "../services/tauri";

function Switch({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <div className="switch-row">
      <div>
        <div className="s-title">{title}</div>
        <div className="s-desc">{desc}</div>
      </div>
      <button className="switch" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)} />
    </div>
  );
}

export function Settings() {
  const { prefs, updatePrefs } = useLauncher();
  if (!prefs) return null;
  const patch = (p: Partial<Prefs>) => void updatePrefs(p);

  return (
    <>
      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Appearance</span></div>
        <div className="theme-gallery">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-card${prefs.theme === t.id ? " selected" : ""}`}
              onClick={() => patch({ theme: t.id })}
              aria-pressed={prefs.theme === t.id}
            >
              <div className="theme-preview" style={{ background: t.bg }}>
                <div className="pv-ambient" style={{ background: `radial-gradient(closest-side, ${t.accent}66, transparent 72%)` }} />
              </div>
              <span className="tname">{t.label}{prefs.theme === t.id && <span className="check">✓</span>}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Preferences</span></div>
        <div className="soft-card">
          <Switch
            title="Check for updates automatically"
            desc="After startup, quietly check the official release channel. Never interrupts launching."
            checked={prefs.autoCheckUpdates}
            onChange={(v) => patch({ autoCheckUpdates: v })}
          />
          <Switch
            title="Show Developer Tools"
            desc="Adds the workspace section (source status, builds, release packaging). For development checkouts."
            checked={prefs.devToolsVisible}
            onChange={(v) => patch({ devToolsVisible: v })}
          />
          <Switch
            title="Reduced motion"
            desc="Minimizes animation in the launcher. The app follows your Windows setting independently."
            checked={prefs.motion === "reduced"}
            onChange={(v) => patch({ motion: v ? "reduced" : "full" })}
          />
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Update channel</span></div>
        <div className="soft-card">
          <div className="btn-row">
            {(["tester", "stable"] as const).map((c) => (
              <button key={c} className={`btn${prefs.channel === c ? "" : " ghost"}`} aria-pressed={prefs.channel === c} onClick={() => patch({ channel: c })}>
                {c === "tester" ? "Tester — receive RC builds" : "Stable — final releases only"}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "0.75rem", color: "var(--ink-faint)" }}>
            Existing release-candidate users should stay on Tester until the first stable release.
          </p>
        </div>
      </section>
    </>
  );
}
