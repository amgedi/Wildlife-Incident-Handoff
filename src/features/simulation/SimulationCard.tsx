/**
 * Simulation card V2 (0.3.0-dev.4, spec 25–28): a COMPACT contextual bar that
 * keeps Test View feeling like a professional workspace — persistent
 * SIMULATION badge + role/intensity/seed + simulated time + quick actions.
 * Role/intensity/seed controls live in an expandable settings sheet, shown
 * on demand. Still impossible to mistake for real operations.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../components/Icons";
import type { SimulationRole, SimulationIntensity } from "./scenario";

export interface SimulationCardProps {
  role: SimulationRole;
  intensity: SimulationIntensity;
  seed: number;
  now: string;
  onAdvanceTime: (minutes: number) => void;
  onRegenerate: () => void;
  onNewSeed: () => void;
  onReset: () => void;
  /** Role/intensity selection for the expanded settings sheet. */
  onConfigure?: (next: { role: SimulationRole; intensity: SimulationIntensity }) => void;
}

const ROLE_LABELS: Record<string, string> = {
  general: "General professional",
  rehabilitator: "Wildlife rehabilitator",
  field_responder: "Field responder",
  dispatcher: "Dispatcher",
  transport: "Transport volunteer",
};
const INTENSITY_LABELS: Record<string, string> = {
  quiet: "Quiet",
  normal: "Normal",
  busy: "Busy",
  surge: "Surge",
};

export function SimulationCard(props: SimulationCardProps) {
  const { t } = useTranslation("professional");
  const [expanded, setExpanded] = useState(false);
  const time = new Date(props.now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="sim-bar" data-testid="simulation-card" role="region" aria-label={t("simTitle", { defaultValue: "Simulation" })}>
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="sim-badge">SIMULATION</span>
        <span className="sim-meta">
          {ROLE_LABELS[props.role] ?? props.role} · {INTENSITY_LABELS[props.intensity] ?? props.intensity} · {t("simSeed", { defaultValue: "Seed" })} {String(props.seed).slice(0, 4)}…
        </span>
        <span className="sim-meta" aria-label={t("simTime", { defaultValue: "Simulated time" })}>{time}</span>
        <span className="row" style={{ gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => props.onAdvanceTime(15)} data-testid="sim-advance">
            {t("simAdvance", { defaultValue: "+15m" })}
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={props.onRegenerate} data-testid="sim-regenerate">
            {t("simRegenerate", { defaultValue: "Regenerate" })}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            data-testid="sim-scenario-toggle"
          >
            {t("simScenario", { defaultValue: "Scenario" })} <Icons.chevronDown size={12} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={props.onReset} data-testid="sim-exit">
            {t("simExit", { defaultValue: "Exit test view" })}
          </button>
        </span>
      </div>
      {expanded && (
        <div className="sim-sheet" data-testid="simulation-settings">
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem" }}>
              {t("simRole", { defaultValue: "Role" })}
              <select
                value={props.role}
                onChange={(e) => props.onConfigure?.({ role: e.target.value as SimulationRole, intensity: props.intensity })}
                style={{ font: "inherit", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--c-border-strong)", background: "var(--c-surface)", color: "var(--c-ink)" }}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem" }}>
              {t("simIntensity", { defaultValue: "Intensity" })}
              <select
                value={props.intensity}
                onChange={(e) => props.onConfigure?.({ role: props.role, intensity: e.target.value as SimulationIntensity })}
                style={{ font: "inherit", padding: "5px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--c-border-strong)", background: "var(--c-surface)", color: "var(--c-ink)" }}
              >
                {Object.entries(INTENSITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <span className="hint" style={{ margin: 0 }}>
              {t("simSeedFull", { defaultValue: "Seed: {{seed}}", seed: props.seed })}
            </span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={props.onNewSeed} data-testid="sim-new-seed">
              {t("simNewSeed", { defaultValue: "New seed" })}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={props.onReset} data-testid="sim-reset">
              {t("simReset", { defaultValue: "Reset simulation" })}
            </button>
          </div>
          <p className="hint" style={{ margin: "8px 0 0" }}>
            {t("simFictionalNote", { defaultValue: "Everything generated here is fictional demo data on this device only — exports keep their fictional labels." })}
          </p>
        </div>
      )}
    </div>
  );
}
