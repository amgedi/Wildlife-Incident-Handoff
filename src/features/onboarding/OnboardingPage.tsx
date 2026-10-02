/**
 * First-run onboarding: five short principles, then the experience-mode
 * questions. Everything skippable. Presentation presets only — never
 * permissions.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { BrandMark } from "../../components/BrandMark";
import { Segmented } from "../../components/ui";
import type { DetailLevel, ExperienceMode } from "../../types/settings";

const MODES: { value: ExperienceMode; label: string; hint: string }[] = [
  { value: "reporter", label: "Reporting wildlife I found", hint: "You found an animal and want to record and pass on what you saw." },
  { value: "rescue", label: "Wildlife rescue / volunteer response", hint: "You receive reports and respond to incidents." },
  { value: "rehab", label: "Wildlife rehabilitation", hint: "You receive animals and record care handoffs." },
  { value: "vet", label: "Veterinary / professional intake", hint: "You take professional intake of wildlife cases." },
  { value: "conservation", label: "Conservation / field work", hint: "You record incidents during field or research work." },
  { value: "general", label: "General / not sure", hint: "A balanced setup that fits most situations." },
];

const PRINCIPLES = [
  { title: "Record what you actually observed", text: "“Right wing hangs lower than left” is more useful and more honest than a guess at a diagnosis." },
  { title: "Unknown is okay", text: "Species, age, sex, cause — you never have to pretend to know. Unknown is a valid, respected answer." },
  { title: "Every update joins the timeline", text: "Your notes build a chronological story instead of overwriting what came before." },
  { title: "Original entries stay traceable", text: "Corrections are recorded, not erased — the history remains visible." },
  { title: "Your data stays local", text: "Everything is stored in this browser on this device, unless you explicitly export or share it." },
];

export function OnboardingPage() {
  const { updateSettings } = useApp();
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);
  const [mode, setMode] = useState<ExperienceMode>("general");
  const [detail, setDetail] = useState<DetailLevel>("standard");

  const finish = () => {
    updateSettings({ onboarded: true, experienceMode: mode, detailLevel: detail });
    navigate("/");
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <div className="row" style={{ gap: 12, marginBottom: "var(--space-6)" }}>
        <BrandMark size={40} />
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Wildlife Incident Handoff</h1>
          <p style={{ margin: 0, color: "var(--c-ink-faint)", fontSize: "0.9rem" }}>Clear information. Safer handoffs.</p>
        </div>
      </div>

      {stage === 0 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>Welcome — here's what this app believes.</h2>
          <div className="stack" style={{ margin: "var(--space-5) 0" }}>
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="card scale-in" style={{ padding: "var(--space-4)", animationDelay: `${i * 40}ms` }}>
                <h3 style={{ marginBottom: 4 }}>
                  <span style={{ color: "var(--c-primary)", marginRight: 8 }}>{i + 1}.</span>
                  {p.title}
                </h3>
                <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{p.text}</p>
              </div>
            ))}
          </div>
          <div className="row between">
            <button className="btn btn-quiet" onClick={finish}>Skip setup</button>
            <button className="btn btn-primary" onClick={() => setStage(1)}>Next</button>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>How will you mostly use Wildlife Incident Handoff?</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>This shapes what the app shows you first. You can change it any time.</p>
          <div className="stack" role="radiogroup" aria-label="Primary use">
            {MODES.map((m) => (
              <button
                key={m.value}
                className="chip"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                style={{ display: "block", width: "100%", textAlign: "left", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }}
              >
                <strong>{m.label}</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--c-ink-faint)" }}>{m.hint}</div>
              </button>
            ))}
          </div>
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(0)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStage(2)}>Next</button>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>How much detail would you like?</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>These are presentation presets only — they never change who can do what.</p>
          <div className="card" style={{ marginTop: "var(--space-5)" }}>
            <Segmented
              label="Detail level"
              value={detail}
              onChange={setDetail}
              options={[
                { value: "simple", label: "Simple" },
                { value: "standard", label: "Standard" },
                { value: "professional", label: "Professional" },
              ]}
            />
            <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem", margin: 0 }}>
              {detail === "simple" && "Guide me step by step. Short, friendly prompts with helpful defaults."}
              {detail === "standard" && "Show normal incident and handoff tools — the recommended balance."}
              {detail === "professional" && "Show detailed intake, custody, timeline and technical fields."}
            </p>
          </div>
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(1)}>Back</button>
            <button className="btn btn-primary btn-lg" onClick={finish}>Get started</button>
          </div>
        </div>
      )}
    </div>
  );
}
