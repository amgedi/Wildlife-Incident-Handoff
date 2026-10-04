/**
 * First-run onboarding, rebuilt (0.2.0-dev.7).
 *
 * Default path is the NORMAL REPORTER path: language → country → optional
 * profile → privacy explanation → ready. The professional path is a
 * deliberate secondary choice, and its setup questions only shape the local
 * "Professional Preview" workspace — they never verify identity or grant
 * authorization (see src/features/network/authorization.ts).
 *
 * `preview` mode (Settings → Advanced → Preview first-run experience) runs
 * the same flow without touching saved settings.
 */
import { useState } from "react";
import { selectableLanguages, suggestLanguage } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { BrandMark } from "../../components/BrandMark";
import { Icons } from "../../components/Icons";
import { TextField } from "../../components/ui";
import { Select } from "../../components/Select";
import { endOnboardingPreview } from "./onboardingState";
import { THEME_CATALOG } from "../settings/themeCatalog";
import type { ThemeName } from "../../types/settings";
import { normalizePhoneForStorage } from "../../utils/phone";

const COUNTRIES = [
  { value: "", label: "Not set" },
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "IE", label: "Ireland" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "NL", label: "Netherlands" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
  { value: "ZA", label: "South Africa" },
  { value: "IN", label: "India" },
  { value: "JP", label: "Japan" },
  { value: "OTHER", label: "Other / not listed" },
];

export function OnboardingPage({ preview = false }: { preview?: boolean }) {
  const { settings, updateSettings } = useApp();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [chosenTheme, setChosenTheme] = useState<ThemeName>(settings.theme);
  const [chosenLanguage, setChosenLanguage] = useState(() => settings.language || suggestLanguage());
  const [country, setCountry] = useState(settings.country);
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    preferred: "no_preference",
    organization: "",
    role: "",
    serviceArea: "",
  });
  const [saveContact, setSaveContact] = useState(false);
  const [proWorkspace, setProWorkspace] = useState(false);

  const finishReporter = () => {
    if (preview) {
      endOnboardingPreview();
      updateSettings({ onboardingPreviewActive: false });
      navigate("/");
      return;
    }
    updateSettings({
      onboarded: true,
      language: chosenLanguage,
      country,
      workspace: proWorkspace ? "professional" : "reporter",
      experienceMode: proWorkspace ? "rescue" : "reporter",
      savedReporterContact: !proWorkspace && saveContact && (contact.name || contact.phone || contact.email)
        ? { name: contact.name, phone: normalizePhoneForStorage(contact.phone, country), email: contact.email, preferred: contact.preferred, organization: contact.organization || undefined, role: contact.role || undefined }
        : null,
      professionalProfile: proWorkspace
        ? {
            name: contact.name,
            organization: contact.organization,
            role: contact.role,
            workEmail: contact.email,
            workPhone: normalizePhoneForStorage(contact.phone, country),
            serviceArea: contact.serviceArea,
          }
        : null,
    });
    void i18n.changeLanguage(chosenLanguage);
    navigate("/");
  };

  const setLang = (code: string) => {
    setChosenLanguage(code);
    void i18n.changeLanguage(code);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      {preview && (
        <div className="notice" style={{ marginBottom: "var(--space-4)", alignItems: "center" }}>
          <Icons.eye size={16} />
          <span style={{ flex: 1 }}>{t("onboarding:previewBanner", { defaultValue: "First-run preview — nothing you do here changes your saved settings." })}</span>
          <button className="btn btn-quiet btn-sm" onClick={finishReporter}>{t("onboarding:previewExit", { defaultValue: "Exit preview" })}</button>
        </div>
      )}
      <div className="row" style={{ gap: 12, marginBottom: "var(--space-6)" }}>
        <BrandMark size={40} />
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>{t("common:appName", { defaultValue: "Wildlife Incident Handoff" })}</h1>
          <p style={{ margin: 0, color: "var(--c-ink-faint)", fontSize: "0.9rem" }}>{t("onboarding:tagline", { defaultValue: "Clear information. Safer handoffs." })}</p>
        </div>
      </div>

      {stage === 0 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:languageTitle", { defaultValue: "Choose your language" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:languageHint", { defaultValue: "Suggested from your device settings — you can change it any time in Settings." })}
          </p>
          <div className="language-grid" role="listbox" aria-label={t("settings:language", { defaultValue: "Language" })} style={{ margin: "var(--space-4) 0" }}>
            {selectableLanguages(settings.devPreviewLocales === true).map((l) => (
              <button
                key={l.code}
                role="option"
                aria-selected={chosenLanguage === l.code}
                className={`language-option${chosenLanguage === l.code ? " selected" : ""}`}
                onClick={() => setLang(l.code)}
              >
                <strong>{l.nativeName}</strong>
                {l.code === suggestLanguage() && <span className="language-badge beta">{t("onboarding:suggested", { defaultValue: "Suggested" })}</span>}
              </button>
            ))}
          </div>
          <div className="row between">
            <button className="btn btn-quiet" onClick={finishReporter}>{t("onboarding:skipSetup", { defaultValue: "Skip setup" })}</button>
            <button className="btn btn-primary" onClick={() => setStage(1)}>{t("common:next", { defaultValue: "Next" })}</button>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:regionTitle", { defaultValue: "Where are you located?" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:regionHint", { defaultValue: "Used for regional defaults like units, and international phone formatting." })}
          </p>
          <div className="card" style={{ marginTop: "var(--space-4)" }}>
            <Select label={t("onboarding:country", { defaultValue: "Country or region" })} value={country} options={COUNTRIES} onChange={setCountry} optional />
          </div>
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(0)}>{t("common:back", { defaultValue: "Back" })}</button>
            <button className="btn btn-primary" onClick={() => setStage(2)}>{t("common:next", { defaultValue: "Next" })}</button>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:profileTitle", { defaultValue: "Would you like to save a profile on this device?" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:profileHint", { defaultValue: "Optional. Saved details can pre-fill new reports for convenience — you always choose what is actually included when you create or share a report." })}
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
              <TextField label={t("onboarding:phone", { defaultValue: "Phone" })} type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} optional hint={t("onboarding:phoneHint", { defaultValue: "Any international format, e.g. +44 7700 900123" })} />
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
            </div>
          )}
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(1)}>{t("common:back", { defaultValue: "Back" })}</button>
            <button className="btn btn-primary" onClick={() => setStage(3)}>{t("common:next", { defaultValue: "Next" })}</button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:themeTitle", { defaultValue: "Pick a look you like" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {t("onboarding:themeHint", { defaultValue: "You can change this any time in Settings → Appearance." })}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, margin: "var(--space-4) 0" }}>
            {THEME_CATALOG.map((th) => (
              <button
                key={th.value}
                className={`language-option${chosenTheme === th.value ? " selected" : ""}`}
                aria-pressed={chosenTheme === th.value}
                onClick={() => {
                  setChosenTheme(th.value);
                  updateSettings({ theme: th.value });
                }}
              >
                <span style={{ display: "flex", gap: 4, marginBottom: 6 }} aria-hidden="true">
                  {th.swatch.map((c) => (
                    <span key={c} style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: "1px solid rgb(127 127 127 / 0.35)", display: "inline-block" }} />
                  ))}
                </span>
                <strong style={{ fontSize: "0.88rem" }}>{th.label}</strong>
              </button>
            ))}
          </div>
          <div className="row between" style={{ marginTop: "var(--space-5)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(2)}>{t("common:back", { defaultValue: "Back" })}</button>
            <button className="btn btn-primary" onClick={() => setStage(4)}>{t("common:next", { defaultValue: "Next" })}</button>
          </div>
        </div>
      )}

      {stage === 4 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:privacyTitle", { defaultValue: "Your records stay on this device" })}</h2>
          <div className="stack" style={{ margin: "var(--space-4) 0" }}>
            {[
              {
                title: t("onboarding:privacyLocal", { defaultValue: "Local-first, no account" }),
                text: t("onboarding:privacyLocalText", { defaultValue: "Reports, photos and backups are stored in this browser on this device. You do not need an account to document injured wildlife." }),
              },
              {
                title: t("onboarding:privacyControl", { defaultValue: "You control every export" }),
                text: t("onboarding:privacyControlText", { defaultValue: "Nothing is sent, published or uploaded automatically. Sharing happens only when you choose it, and each export shows exactly what it contains." }),
              },
              {
                title: t("onboarding:privacyLocation", { defaultValue: "Locations can stay vague" }),
                text: t("onboarding:privacyLocationText", { defaultValue: "Choose exact, approximate or sensitive location for each report — useful for protected species or private land." }),
              },
            ].map((p, i) => (
              <div key={p.title} className="card scale-in" style={{ padding: "var(--space-4)", animationDelay: `${i * 40}ms` }}>
                <h3 style={{ marginBottom: 4 }}>
                  <span style={{ color: "var(--c-primary)", marginRight: 8 }}>{i + 1}.</span>
                  {p.title}
                </h3>
                <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{p.text}</p>
              </div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: "var(--space-6)" }}>
            <button className="btn btn-ghost" onClick={() => setStage(3)}>{t("common:back", { defaultValue: "Back" })}</button>
            <button className="btn btn-primary" onClick={() => setStage(5)}>{t("common:next", { defaultValue: "Next" })}</button>
          </div>
        </div>
      )}

      {stage === 5 && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.25rem" }}>{t("onboarding:readyTitle", { defaultValue: "You're ready" })}</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>{t("onboarding:readyHint", { defaultValue: "Choose how you'd like to start. You can change this any time in Settings." })}</p>
          <div className="stack" style={{ margin: "var(--space-4) 0" }}>
            <button className="btn btn-primary btn-lg" onClick={finishReporter} style={{ justifyContent: "center" }}>
              {t("onboarding:continueReporter", { defaultValue: "Continue as reporter" })}
            </button>
            {!proWorkspace && (
              <button className="btn btn-secondary" onClick={() => setProWorkspace(true)}>
                {t("onboarding:professionalPath", { defaultValue: "I work or volunteer in wildlife response" })}
              </button>
            )}
          </div>
          {proWorkspace && (
            <div className="card">
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.users size={18} /> {t("onboarding:professionalSetup", { defaultValue: "Local professional workspace" })}
              </h3>
              <div className="notice" style={{ margin: "var(--space-3) 0" }}>
                <Icons.shield size={16} />
                <span>{t("onboarding:professionalPreviewNote", { defaultValue: "This sets up the local Professional Preview workspace. It is not professional verification — verified responder permissions will require approval through a real response organization." })}</span>
              </div>
              <div className="grid-2">
                <TextField label={t("onboarding:name", { defaultValue: "Name" })} value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} optional />
                <TextField label={t("onboarding:organization", { defaultValue: "Organization" })} value={contact.organization} onChange={(v) => setContact({ ...contact, organization: v })} optional />
                <TextField label={t("onboarding:role", { defaultValue: "Role" })} value={contact.role} onChange={(v) => setContact({ ...contact, role: v })} optional hint={t("onboarding:roleHint", { defaultValue: "e.g. Responder, dispatcher, rehabilitator, ranger" })} />
                <TextField label={t("onboarding:workEmail", { defaultValue: "Work email" })} type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} optional />
                <TextField label={t("onboarding:workPhone", { defaultValue: "Work phone" })} type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} optional />
                <TextField label={t("onboarding:serviceArea", { defaultValue: "Service area" })} value={contact.serviceArea} onChange={(v) => setContact({ ...contact, serviceArea: v })} optional hint={t("onboarding:serviceAreaHint", { defaultValue: "You can draw or describe this later in the professional dashboard." })} />
              </div>
              <div className="row" style={{ marginTop: "var(--space-3)" }}>
                <button className="btn btn-primary" onClick={finishReporter}>
                  {t("onboarding:openProfessional", { defaultValue: "Open professional workspace" })}
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => setProWorkspace(false)}>{t("common:back", { defaultValue: "Back" })}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
