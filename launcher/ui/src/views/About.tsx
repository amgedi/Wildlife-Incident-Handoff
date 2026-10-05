/** About — product identity, license, subtle support links. */
import { useLauncher } from "../app/store";

function Support() {
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--ink-soft)" }}>{label}</a>
  );
  return (
    <span style={{ display: "inline-flex", gap: 14, fontSize: "0.78rem", alignItems: "center" }}>
      <IconHeart />
      {link("https://github.com/sponsors/amgedi", "GitHub Sponsors")}
      {link("https://ko-fi.com/openfhs", "Ko-fi")}
      {link("https://buymeacoffee.com/openfhs", "Buy Me a Coffee")}
    </span>
  );
}

import { IconHeart } from "../components/icons";

export function About() {
  const { identity } = useLauncher();
  const version = identity?.desktop?.version ?? identity?.version ?? "0.3.0-rc.2";
  return (
    <>
      <section className="launch-panel view-enter" style={{ alignItems: "center", textAlign: "center" }}>
        <img src="./emblem.png" alt="Wildlife Incident Handoff emblem" style={{ width: 76, height: 76, borderRadius: 20, boxShadow: "var(--shadow-2)" }} />
        <h1 style={{ margin: "10px 0 0", fontSize: "1.3rem", letterSpacing: "0.03em" }}>WILDLIFE INCIDENT HANDOFF</h1>
        <p style={{ margin: "2px 0 0", color: "var(--ink-soft)" }}>Clear information. Safer handoffs.</p>
        <p style={{ margin: "14px 0 0", fontSize: "0.9rem" }}>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{version}</strong>
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--ink-faint)" }}>
          Open source · License AGPL-3.0-only
        </p>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: "center" }}>
          <button className="btn ghost" onClick={() => window.open("https://github.com/amgedi/Wildlife-Incident-Handoff", "_blank")}>Repository</button>
          <button className="btn ghost" onClick={() => window.open("https://github.com/amgedi/Wildlife-Incident-Handoff#privacy--local-first-model", "_blank")}>Privacy</button>
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Credits</span></div>
        <div className="soft-card">
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            Built with Tauri, React, MapLibre GL. Map data © OpenStreetMap contributors;
            terrain elevation via AWS Terrain Tiles. Full notices in the app under Help → Licenses.
          </p>
        </div>
      </section>

      <section className="section view-enter">
        <div className="section-head"><span className="section-title">Support development</span></div>
        <div className="soft-card" style={{ display: "flex", justifyContent: "center" }}>
          <Support />
        </div>
      </section>
    </>
  );
}
