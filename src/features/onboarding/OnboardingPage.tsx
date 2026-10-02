/**
 * First-run onboarding: five short principles, then the experience-mode
 * questions. Everything skippable. Presentation presets only — never
 * permissions.
 */
import { useState } from "react";
import { LANGUAGE_CATALOG, suggestLanguage } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { BrandMark } from "../../components/BrandMark";
import { TextField } from "../../components/ui";
import { Select } from "../../components/Select";
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
  const { t, i18n } = useTranslation();
  const [stage, setStage] = useState(0);
  const [mode, setMode] = useState<ExperienceMode>("general");
  const [detail, setDetail] = useState<DetailLevel>("standard");
  const [suggested] = useState(() => suggestLanguage());
  const [chosenLanguage, setChosenLanguage] = useState(suggested);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", preferred: "no_preference", organization: "" });
  const [saveContact, setSaveContact] = useState(false);

  const finish = () => {
    const professional: ExperienceMode[] = ["rescue", "rehab", "vet", "conservation"];
    updateSettings({
      onboarded: true,
      language: chosenLanguage,
      experienceMode: mode,
      detailLevel: detail,
      workspace: professional.includes(mode) ? "professional" : "reporter",
      savedReporterContact: saveContact && (contact.name || contact.phone || contact.email)
        ? { name: contact.name, phone: contact.phone, email: contact.email, preferred: contact.preferred }
        : null,
    });
    void i18n.changeLanguage(chosenLanguage);
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
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:languageTitle", { defaultValue: "Choose your language" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:languageHint", { defaultValue: "Suggested from your device settings — you can change it any time in Settings." })}
          </p>
          <div className="language-grid" role="listbox" aria-label={t("settings:language", { defaultValue: "Language" })} style={{ margin: "var(--space-4) 0" }}>
            {LANGUAGE_CATALOG.map((l) => (
              <button
                key={l.code}
                role="option"
                aria-selected={chosenLanguage === l.code}
                className={`language-option${chosenLanguage === l.code ? " selected" : ""}`}
                onClick={() => { setChosenLanguage(l.code); void i18n.changeLanguage(l.code); }}
              >
                <strong>{l.nativeName}</strong>
                {l.code === suggested && <span className="language-badge beta">{t("onboarding:suggested", { defaultValue: "Suggested" })}</span>}
              </button>
            ))}
          </div>
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:principlesTitle", { defaultValue: "Here's what this app believes." })}</h2>
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
            <button className="btn btn-primary" onClick={() => setStage(3)}>Next</button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>
            {t("onboarding:contactTitle", { defaultValue: "Would you like to save your contact details on this device?" })}
          </h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:contactExplain", { defaultValue: "These can be filled into future reports automatically. You choose whether they are actually included when sharing each report." })}
          </p>
          <div className="notice" style={{ margin: "var(--space-3) 0" }}>
            {t("onboarding:contactLocalOnly", { defaultValue: "Stored only on this device." })}{" "}
            {t("onboarding:contactNeverAuto", { defaultValue: "Never uploaded, never included in exports automatically." })}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer", marginBottom: "var(--space-3)" }}>
            <input type="checkbox" checked={saveContact} onChange={(e) => setSaveContact(e.target.checked)} />
            {t("onboarding:saveContact", { defaultValue: "Save my contact details on this device" })}
          </label>
          {saveContact && (
            <div className="grid-2">
              <TextField label={t("onboarding:name", { defaultValue: "Name" })} value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} optional />
              <TextField label={t("onboarding:phone", { defaultValue: "Phone" })} value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} optional hint="International format welcome, e.g. +44 7700 900123" />
              <TextField label={t("onboarding:email", { defaultValue: "Email" })} type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} optional />
              <Select
                label={t("onboarding:preferredMethod", { defaultValue: "Preferred contact method" })}
                value={contact.preferred}
                onChange={(v) => setContact({ ...contact, preferred: v })}
                options={[
                  { value: "phone", label: t("onboarding:mPhone", { defaultValue: "Phone" }) },
                  { value: "text", label: t("onboarding:mText", { defaultValue: "Text" }) },
                  { value: "email", label: t("onboarding:mEmail", { defaultValue: "Email" }) },
                  { value: "no_preference", label: t("onboarding:mNone", { defaultValue: "No preference" }) },
                ]}
                optional
              />
              {(mode === "rescue" || mode === "rehab" || mode === "vet" || mode === "conservation") && (
                <TextField label={t("onboarding:organization", { defaultValue: "Organization (optional, for professionals)" })} value={contact.organization} onChange={(v) => setContact({ ...contact, organization: v })} optional />
              )}
            </div>
          )}
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(2)}>Back</button>
            <button className="btn btn-primary btn-lg" onClick={finish}>
              {t("onboarding:getStarted", { defaultValue: "Get started" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
