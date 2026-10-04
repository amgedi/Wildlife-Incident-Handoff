/**
 * Simulation card (0.3, spec items 94–95, 107–109): control surface for the
 * simulated work environment. Pure presentation — all state (role, intensity,
 * seed, simulated time) is owned by the parent, which wires persistence.
 */
import { useTranslation } from "react-i18next";
import type { SimulationIntensity, SimulationRole } from "./scenario";
import { INTENSITY_COUNTS } from "./scenario";

export interface SimulationCardProps {
  role: SimulationRole;
  intensity: SimulationIntensity;
  seed: number;
  /** Simulated time shown to the user (ISO string from scenario.baseNow). */
  now: string;
  /** Advance the simulated clock (the card passes +15 minutes). */
  onAdvanceTime: (minutes: number) => void;
  /** Regenerate the scenario with the same role/intensity/seed. */
  onRegenerate: () => void;
  /** Pick a fresh seed and regenerate. */
  onNewSeed: () => void;
  /** Reset the simulation to its initial settings. */
  onReset: () => void;
}

export function SimulationCard(props: SimulationCardProps) {
  const { t } = useTranslation("professional");
  return (
    <section className="card" data-testid="simulation-card" aria-label={t("simTitle")}>
      <h2 className="section-label">{t("simTitle")}</h2>
      <p className="hint">{t("simHint")}</p>

      <p className="hint" data-testid="sim-meta">
        {t("simRole")}: <strong data-testid="sim-role">{t(`simRole_${props.role}`)}</strong>
        {" · "}
        {t("simIntensity")}: <strong data-testid="sim-intensity">{t(`simIntensity_${props.intensity}`)}</strong>{" "}
        ({INTENSITY_COUNTS[props.intensity][0]}–{INTENSITY_COUNTS[props.intensity][1]})
        <br />
        {t("simSeed")}: <code data-testid="sim-seed">{props.seed}</code>
        {" · "}
        {t("simTime")}: <time dateTime={props.now} data-testid="sim-time">{new Date(props.now).toLocaleString()}</time>
      </p>

      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={() => props.onAdvanceTime(15)} data-testid="sim-advance">
          {t("simAdvance")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={props.onRegenerate} data-testid="sim-regenerate">
          {t("simRegenerate")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={props.onNewSeed} data-testid="sim-new-seed">
          {t("simNewSeed")}
        </button>
        <button type="button" className="btn btn-quiet" onClick={props.onReset} data-testid="sim-reset">
          {t("simReset")}
        </button>
      </div>
    </section>
  );
}
