/** Settings: left nav sections + right content, settings search, storage health. */
import { useMemo, useState } from "react";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { Segmented, TextField } from "../../components/ui";
import { Select } from "../../components/Select";
import { Dialog } from "../../components/Dialog";
import { downloadBackup, importBackup } from "../../storage/backupService";
import { getAllIncidents, getAllAttachmentBlobs, estimateStorage, setSetting } from "../../storage/repositories";
import { bytesToSize } from "../../utils/time";
import { useEffect } from "react";
import { APP_VERSION as appVersion, BUILD_ID as buildId, DATA_SCHEMA_VERSION as dataSchemaVersion, APP_LICENSE } from "../../version";
import { defaultUnitsFor } from "../../utils/units";
import { isTauri } from "../../utils/platformFile";
import { LANGUAGE_CATALOG } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { DetailLevel, ExperienceMode, MotionPreference, ThemeName } from "../../types/settings";

const SECTIONS = [
  { id: "appearance", labelKey: "appearance", icon: Icons.eye, keywords: "theme appearance dark light density motion" },
  { id: "experience", labelKey: "experience", icon: Icons.compass, keywords: "experience mode detail level profile workspace" },
  { id: "accessibility", labelKey: "accessibility", icon: Icons.heart, keywords: "accessibility motion reduced contrast keyboard" },
  { id: "profile", labelKey: "profile", icon: Icons.heart, keywords: "profile contact name phone email organization" },
  { id: "defaults", labelKey: "defaults", icon: Icons.list, keywords: "incident defaults location precision name" },
  { id: "privacy", labelKey: "privacy", icon: Icons.shield, keywords: "privacy location contacts shareable" },
  { id: "storage", labelKey: "storage", icon: Icons.archive, keywords: "backup storage import export where is my data" },
  { id: "notifications", labelKey: "notifications", icon: Icons.info, keywords: "notifications toasts" },
  { id: "advanced", labelKey: "advanced", icon: Icons.settings, keywords: "advanced language region units" },
  { id: "about", labelKey: "about", icon: Icons.book, keywords: "about version license" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsPage() {
  const [section, setSection] = useState<SectionId>("appearance");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter((s) => s.labelKey.includes(q) || s.keywords.includes(q));
  }, [query]);

  const activeMeta = SECTIONS.find((s) => s.id === section)!;
  const ts = useTranslation("settings").t;

  return (
    <main className="content" id="main-content" style={{ maxWidth: 1080 }}>
      <h1>Settings</h1>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="settings-search" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Search settings</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: 11, color: "var(--c-ink-faint)" }} aria-hidden="true"><Icons.search size={16} /></span>
          <input id="settings-search" className="input" style={{ paddingLeft: 34 }} placeholder='e.g. "backup", "motion", "privacy"' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim() && (
          <p className="hint">{filtered.length} matching section{filtered.length === 1 ? "" : "s"}</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 220px) 1fr", gap: "var(--space-6)" }} className="settings-grid">
        <nav aria-label="Settings sections" style={{ borderRight: "1px solid var(--c-border)" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? "true" : undefined}
                  style={{
                    display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
                    padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                    font: "inherit", fontSize: "0.92rem",
                    background: section === s.id ? "var(--c-primary)" : "transparent",
                    color: section === s.id ? "var(--c-primary-ink)" : "var(--c-ink-soft)",
                    fontWeight: section === s.id ? 650 : 400,
                  }}
                >
                  <s.icon size={17} />
                  {ts(s.labelKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="fade-in" key={section}>
          <h2>{ts(activeMeta.labelKey)}</h2>
          {section === "appearance" && <AppearanceSection />}
          {section === "experience" && <ExperienceSection />}
          {section === "accessibility" && <AccessibilitySection />}
          {section === "profile" && <ProfileSection />}
          {section === "defaults" && <DefaultsSection />}
          {section === "privacy" && <PrivacySection />}
          {section === "storage" && <StorageSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "advanced" && <AdvancedSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
      <style>{`@media (max-width: 800px){.settings-grid{grid-template-columns:1fr !important}nav[aria-label="Settings sections"]{border-right:none !important}}`}</style>
    </main>
  );
}

function AppearanceSection() {
  const { settings, updateSettings } = useApp();
  const themes: { value: ThemeName; label: string; swatch: string[] }[] = [
    { value: "forest-dark", label: "Forest Dark", swatch: ["#1f3d2b", "#2f5d3f", "#f0f3ec"] },
    { value: "forest-light", label: "Forest Light", swatch: ["#e3ead9", "#2f5d3f", "#eef2e9"] },
    { value: "midnight", label: "Midnight", swatch: ["#10151d", "#4f9d6e", "#e2e8ee"] },
    { value: "warm-field", label: "Warm Field", swatch: ["#4a3b28", "#7a5a2e", "#f7f2e8"] },
    { value: "moss", label: "Moss", swatch: ["#3f5233", "#55702f", "#eceee4"] },
    { value: "ocean", label: "Ocean", swatch: ["#123a5c", "#1c6e8c", "#e9eff4"] },
    { value: "slate", label: "Slate", swatch: ["#2d3748", "#4a6285", "#eef0f2"] },
    { value: "high-contrast-dark", label: "High Contrast Dark", swatch: ["#000000", "#7fb7ff", "#ffffff"] },
    { value: "mono-dark", label: "Monochrome Dark", swatch: ["#050505", "#e8e8e8", "#f2f2f2"] },
    { value: "mono-light", label: "Monochrome Light", swatch: ["#111111", "#171717", "#fafafa"] },
  ];
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Theme</h3>
        <div className="grid-2">
          {themes.map((th) => (
            <button
              key={th.value}
              onClick={() => updateSettings({ theme: th.value })}
              aria-pressed={settings.theme === th.value}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "var(--space-3)", cursor: "pointer",
                borderRadius: "var(--radius-md)", font: "inherit",
                border: settings.theme === th.value ? "2px solid var(--c-primary)" : "1px solid var(--c-border)",
                background: "var(--c-surface)", color: "var(--c-ink)",
              }}
            >
              <span style={{ display: "flex" }} aria-hidden="true">
                {th.swatch.map((c) => (
                  <span key={c} style={{ width: 22, height: 22, borderRadius: "50%", background: c, marginLeft: -6, border: "2px solid var(--c-surface)" }} />
                ))}
              </span>
              {th.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <Segmented
          label="Interface density"
          value={settings.density}
          onChange={(v) => updateSettings({ density: v })}
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
        />
      </div>
      <div className="card">
        <Segmented
          label="Motion"
          value={settings.motion}
          onChange={(v) => updateSettings({ motion: v })}
          options={[
            { value: "full", label: "Full" },
            { value: "reduced", label: "Reduced" },
            { value: "off", label: "Off" },
          ]}
        />
        <p className="hint">Reduced and Off also respect your operating system's “reduce motion” preference. Animations never delay actions.</p>
        <Segmented
          label="Ambient theme effects"
          value={settings.ambient}
          onChange={(v) => updateSettings({ ambient: v })}
          options={[
            { value: "on", label: "On" },
            { value: "reduced", label: "Reduced" },
            { value: "off", label: "Off" },
          ]}
        />
        <p className="hint">A very slow background ambience behind the interface — each theme has its own character. Functional transitions keep working even with ambience off, and the background never animates when your OS requests reduced motion.</p>
      </div>
    </div>
  );
}

function ExperienceSection() {
  const { settings, updateSettings } = useApp();
  const modes: { value: ExperienceMode; label: string }[] = [
    { value: "reporter", label: "Reporting wildlife I found" },
    { value: "rescue", label: "Wildlife rescue / volunteer response" },
    { value: "rehab", label: "Wildlife rehabilitation" },
    { value: "vet", label: "Veterinary / professional intake" },
    { value: "conservation", label: "Conservation / field work" },
    { value: "general", label: "General / not sure" },
  ];
  return (
    <div className="card">
      <p style={{ color: "var(--c-ink-soft)" }}>These shape what the app shows you. They are presentation presets only — they never create or restrict permissions.</p>
      <Segmented
        label="Workspace"
        value={settings.workspace}
        onChange={(v) => updateSettings({ workspace: v })}
        options={[
          { value: "reporter", label: "Reporter" },
          { value: "professional", label: "Professional / responder" },
        ]}
      />
      <p className="hint">
        Reporter keeps navigation focused on reporting and your own records. Professional adds the response dashboard and
        network tools. Switching never deletes or alters records, and is not an authorization system.
      </p>
      <Select label="How will you mostly use the app?" value={settings.experienceMode} options={modes} onChange={(v) => updateSettings({ experienceMode: v as ExperienceMode })} />
      <Segmented
        label="How much detail would you like?"
        value={settings.detailLevel}
        onChange={(v) => updateSettings({ detailLevel: v })}
        options={[
          { value: "simple", label: "Simple" },
          { value: "standard", label: "Standard" },
          { value: "professional", label: "Professional" },
        ] as { value: DetailLevel; label: string }[]}
      />
      <TextField label="Your name (used as the default ‘recorded by’ on updates)" value={settings.displayName} onChange={(v) => updateSettings({ displayName: v })} optional />
    </div>
  );
}

function AccessibilitySection() {
  const { settings, updateSettings } = useApp();
  const motionOptions: { value: MotionPreference; label: string }[] = [
    { value: "full", label: "Full" },
    { value: "reduced", label: "Reduced" },
    { value: "off", label: "Off" },
  ];
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Motion</h3>
      <Segmented label="Animation level" value={settings.motion} onChange={(v) => updateSettings({ motion: v })} options={motionOptions} />
      <p className="hint">
        Full uses the app's normal subtle animations. Reduced keeps only the shortest transitions. Off removes all movement.
        The app also follows your system “prefers reduced motion” setting automatically.
      </p>
      <p className="hint">Ambient background effects follow the Appearance → “Ambient theme effects” setting and are automatically calmed when your OS requests reduced motion.</p>
      <h3>Keyboard & screen readers</h3>
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
        All controls are reachable by keyboard; dialogs trap focus and restore it on close. Status is never conveyed by color
        alone. If you hit an accessibility barrier, please report it (see CONTRIBUTING.md) — it's treated as a bug.
      </p>
    </div>
  );
}

function DefaultsSection() {
  const { settings, updateSettings } = useApp();
  return (
    <div className="card">
      <Select
        label="Default location precision for new incidents"
        value={settings.defaultLocationPrecision}
        options={[
          { value: "exact", label: "Exact location", hint: "Full detail, including coordinates if provided." },
          { value: "approximate", label: "Approximate location", hint: "Description of the general area only." },
          { value: "sensitive", label: "Sensitive location", hint: "Deliberately vague — for sensitive sites or species." },
        ]}
        onChange={(v) => updateSettings({ defaultLocationPrecision: v as "exact" })}
      />
    </div>
  );
}

function PrivacySection() {
  const { settings, updateSettings } = useApp();
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Where is my data?</h3>
        <p style={{ color: "var(--c-ink-soft)" }}>
          Incident records are stored in this browser on this device. Nothing is uploaded anywhere — there is no cloud
          service, account or tracking. Clearing your browser's site data can delete local records, so regular backups are
          recommended (Storage & backups).
        </p>
        <p style={{ color: "var(--c-ink-soft)", margin: 0 }}>
          Exports are always user-controlled: the app never publishes or sends data automatically.
        </p>
      </div>
      <div className="card">
        <h3>Shareable exports</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.includeContactsInShareable}
            onChange={(e) => updateSettings({ includeContactsInShareable: e.target.checked })}
          />
          Include personal contact details in shareable exports by default
        </label>
        <p className="hint">Recommended off. Even with this on, each export shows exactly what's included before you save or print.</p>
      </div>
      <div className="notice">
        <Icons.shield size={18} />
        <span>Wildlife locations can be sensitive (e.g. protected species or private land). Use “Sensitive location” for
          anything that shouldn't be exposed precisely, and prefer shareable exports when sending records onward.</span>
      </div>
    </div>
  );
}


function StorageSection() {
  const { settings, updateSettings, showToast } = useApp();
  const [stats, setStats] = useState<{ incidents: number; attachments: number; usage: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; warnings: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [incidents, blobs, est] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs(), estimateStorage()]);
      setStats({
        incidents: incidents.length,
        attachments: blobs.length,
        usage: est ? bytesToSize(est.usage) : "not reported by this browser",
      });
    })();
  }, []);

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = await importBackup(parsed);
      setImportResult(result);
      setImportOpen(true);
      if (result.imported > 0) showToast(`Imported ${result.imported} incident${result.imported === 1 ? "" : "s"}`);
      else showToast("Nothing imported — see details");
      updateSettings({ lastBackupAt: settings.lastBackupAt });
    } catch {
      showToast("That file could not be read as a Wildlife Incident Handoff backup.");
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Storage health</h3>
        {stats ? (
          <dl className="kv">
            <dt>Incidents</dt><dd>{stats.incidents}</dd>
            <dt>Attachments</dt><dd>{stats.attachments}</dd>
            <dt>Local storage used</dt><dd>{stats.usage}</dd>
            <dt>Last backup</dt><dd>{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : "Never"}</dd>
          </dl>
        ) : (
          <p style={{ color: "var(--c-ink-faint)" }}>Counting…</p>
        )}
        <div className="row" style={{ marginTop: "var(--space-4)" }}>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const r = await downloadBackup(appVersion);
              if (r !== "cancelled") {
                updateSettings({ lastBackupAt: new Date().toISOString() });
                showToast("Backup exported");
              }
            }}
          >
            <Icons.download size={16} /> Create backup
          </button>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            <Icons.upload size={16} /> Import backup
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="hint">Backups include all incidents and photos in a versioned JSON file. Importing never overwrites existing incidents with the same ID — duplicates are skipped and reported.</p>
      </div>
      <div className="notice warning">
        <Icons.warning size={18} />
        <span>Clearing browser data (site data / storage) will permanently delete local incidents. There is no cloud
          copy. Export a backup before clearing data or switching devices.</span>
      </div>

      <Dialog
        open={importOpen}
        title="Import results"
        onClose={() => setImportOpen(false)}
        actions={<button className="btn btn-primary" onClick={() => setImportOpen(false)}>Done</button>}
      >
        {importResult && (
          <div>
            <p><strong>{importResult.imported}</strong> incident{importResult.imported === 1 ? "" : "s"} imported, <strong>{importResult.skipped}</strong> skipped.</p>
            {importResult.warnings.length > 0 && (
              <ul style={{ paddingLeft: 20 }}>
                {importResult.warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4, fontSize: "0.9rem" }}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function NotificationsSection() {
  const { showToast } = useApp();
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>In-app notifications</h3>
      <p style={{ color: "var(--c-ink-soft)" }}>
        The app confirms important actions with a brief notification at the bottom of the screen (with Undo where safe).
        Wildlife Incident Handoff does not send push notifications, emails or any other outbound messages.
      </p>
      <button className="btn btn-secondary btn-sm" onClick={() => showToast("This is what a notification looks like")}>
        Preview notification
      </button>
    </div>
  );
}

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

function AdvancedSection() {
  const { settings, updateSettings } = useApp();
  const { t } = useTranslation();
  const complete = LANGUAGE_CATALOG.filter((l) => l.completeness === "complete");
  void complete;
  const beta = LANGUAGE_CATALOG.filter((l) => l.completeness === "beta");
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Region & language</h3>
        <div className="field">
          <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{t("settings:language")}</span>
          <div className="language-grid" role="listbox" aria-label={t("settings:language")}>
            {complete.map((l) => (
              <button
                key={l.code}
                role="option"
                aria-selected={settings.language === l.code}
                className={`language-option${settings.language === l.code ? " selected" : ""}`}
                onClick={() => updateSettings({ language: l.code })}
              >
                <strong>{l.nativeName}</strong>
                <span className="language-badge complete">Complete</span>
              </button>
            ))}
            {beta.map((l) => (
              <button
                key={l.code}
                role="option"
                aria-selected={settings.language === l.code}
                className={`language-option${settings.language === l.code ? " selected" : ""}`}
                onClick={() => updateSettings({ language: l.code })}
                title="Partial — falls back to English"
              >
                <strong>{l.nativeName}</strong>
                <span className="language-badge beta">Beta</span>
              </button>
            ))}
          </div>
          <p className="hint">{t("settings:languageHint")}</p>
        </div>
        <Select
          label="Country or region"
          value={settings.country}
          options={COUNTRIES}
          onChange={(v) => updateSettings({ country: v, units: defaultUnitsFor(v) })}
          hint="Used for regional defaults and, in future, for finding participating response organizations near you. Dates, times and numbers follow your browser's locale settings."
        />
        <Select
          label="Measurement units"
          value={settings.units}
          options={[
            { value: "metric", label: "Metric (km, kg, °C)" },
            { value: "imperial", label: "Imperial (mi, lb, °F)" },
          ]}
          onChange={(v) => updateSettings({ units: v as "metric" })}
        />
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
          User observations, species names, organization names and incident references are never translated.
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Status chip reference</h3>
        <p className="hint" style={{ marginTop: 0 }}>All incident statuses side by side for visual comparison in this theme.</p>
        <StatusFixture />
      </div>
      <div className="notice">
        <Icons.info size={18} />
        <span>
          If there is immediate danger to people, contact your local emergency service. Emergency numbers differ by
          country — this app intentionally does not display a specific number.
        </span>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const saved = settings.savedReporterContact;
  const [draft, setDraft] = useState(saved ?? { name: "", phone: "", email: "", preferred: "no_preference" });

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("profileTitle", { defaultValue: "Contact details" })}</h3>
        <p style={{ color: "var(--c-ink-soft)" }}>
          {t("profileBlurb", { defaultValue: "Saved details pre-fill new reports for convenience. You always choose whether they are actually included when creating or sharing a report — nothing is sent or shared automatically." })}
        </p>
        <div className="notice" style={{ margin: "var(--space-3) 0" }}>{t("profileLocal", { defaultValue: "Stored locally on this device." })}</div>
        <div className="grid-2">
          <TextField label={t("profileName", { defaultValue: "Name" })} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} optional />
          <TextField label={t("profilePhone", { defaultValue: "Phone" })} type="tel" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} optional hint="International format welcome, e.g. +44 7700 900123" />
          <TextField label={t("profileEmail", { defaultValue: "Email" })} type="email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} optional />
          <Select
            label={t("profilePreferred", { defaultValue: "Preferred contact method" })}
            value={draft.preferred}
            onChange={(v) => setDraft({ ...draft, preferred: v })}
            options={[
              { value: "phone", label: t("profileMPhone", { defaultValue: "Phone" }) },
              { value: "text", label: t("profileMText", { defaultValue: "Text" }) },
              { value: "email", label: t("profileMEmail", { defaultValue: "Email" }) },
              { value: "no_preference", label: t("profileMNone", { defaultValue: "No preference" }) },
            ]}
            optional
          />
        </div>
        <div className="row" style={{ marginTop: "var(--space-3)" }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const has = draft.name || draft.phone || draft.email;
              updateSettings({ savedReporterContact: has ? draft : null });
              if (has) void setSetting("saved-reporter-contact", draft);
              else void setSetting("saved-reporter-contact", null);
              showToast(t("profileSaved", { defaultValue: "Contact details saved" }));
            }}
          >
            {t("profileSave", { defaultValue: "Save details" })}
          </button>
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setDraft({ name: "", phone: "", email: "", preferred: "no_preference" });
              updateSettings({ savedReporterContact: null });
              void setSetting("saved-reporter-contact", null);
              showToast(t("profileCleared", { defaultValue: "Saved contact details cleared" }));
            }}
          >
            <Icons.trash size={14} /> {t("profileClear", { defaultValue: "Clear" })}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateChecker() {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "checking" | "uptodate" | { available: string } | "failed">("idle");
  async function check() {
    setState("checking");
    try {
      const res = await fetch("https://api.github.com/repos/amgedi/wildlife-incident-handoff/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("http");
      const data = (await res.json()) as { tag_name?: string; html_url?: string };
      const latest = (data.tag_name ?? "").replace(/^v/, "");
      if (latest && latest !== appVersion) setState({ available: latest });
      else setState("uptodate");
    } catch {
      setState("failed");
    }
  }
  return (
    <div className="row" style={{ marginTop: "var(--space-4)", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn btn-secondary btn-sm" onClick={() => void check()} disabled={state === "checking"}>
        {state === "checking" ? "…" : t("settings:checkUpdates")}
      </button>
      {state === "uptodate" && <span className="badge open">{t("settings:upToDate")}</span>}
      {typeof state === "object" && state !== null && "available" in state && (
        <>
          <span className="badge warn">{t("settings:updateAvailable", { version: state.available })}</span>
          <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff/releases" target="_blank" rel="noreferrer">{t("settings:viewRelease")}</a>
        </>
      )}
      {state === "failed" && <span style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>{t("settings:updateCheckFailed")}</span>}
    </div>
  );
}

function StatusFixture() {
  const statuses = [
    "draft","reported","response_requested","responder_assigned","awaiting_pickup","in_transport",
    "transferred","in_care","veterinary_care","monitoring","released","deceased","closed","cancelled",
  ] as const;
  const labels: Record<string, string> = {
    draft: "Draft", reported: "Reported", response_requested: "Response requested",
    responder_assigned: "Responder assigned", awaiting_pickup: "Awaiting pickup", in_transport: "In transport",
    transferred: "Transferred", in_care: "In care", veterinary_care: "Veterinary care", monitoring: "Monitoring",
    released: "Released", deceased: "Deceased", closed: "Closed", cancelled: "Cancelled",
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {statuses.map((st) => (
        <span key={st} className="badge" data-status={st}>{labels[st]}</span>
      ))}
    </div>
  );
}

function AboutSection() {
  const { settings } = useApp();
  const [diagCopied, setDiagCopied] = useState(false);
  async function copyDiagnostics() {
    const [inc, blobs, est] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs(), estimateStorage()]);
    const lines = [
      "Wildlife Incident Handoff — diagnostics",
      `applicationVersion: ${appVersion}`,
      `buildId: ${buildId}`,
      `dataSchemaVersion: ${dataSchemaVersion}`,
      `platform: ${isTauri() ? "desktop (Tauri)" : "web/PWA"}`,
      `workspace: ${settings.workspace}`,
      `theme: ${settings.theme}`,
      `motion: ${settings.motion}`,
      `ambient: ${settings.ambient}`,
      `language: ${settings.language}`,
      `mapProvider: maplibre-osm (OpenStreetMap raster tiles)`,
      `incidents: ${inc.length}`,
      `attachments: ${blobs.length}`,
      `storageUsage: ${est ? bytesToSize(est.usage) : "not reported"}`,
    ].join(String.fromCharCode(10));
    await navigator.clipboard.writeText(lines);
    setDiagCopied(true);
    setTimeout(() => setDiagCopied(false), 2500);
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Wildlife Incident Handoff</h3>
      <dl className="kv">
        <dt>Version</dt><dd>{appVersion}</dd>
        <dt>Build</dt><dd><code>{buildId}</code></dd>
        <dt>Data format</dt><dd>v{dataSchemaVersion} (schemaVersion)</dd>
        <dt>License</dt><dd>{APP_LICENSE} <a href="https://www.gnu.org/licenses/agpl-3.0.txt" target="_blank" rel="noreferrer">View license</a></dd>
        <dt>Data location</dt><dd>This browser, this device</dd>
      </dl>
      <p style={{ color: "var(--c-ink-soft)", marginTop: "var(--space-4)" }}>
        An open-source, local-first tool for creating clear and traceable wildlife incident handoffs.
      </p>
      <UpdateChecker />
      <div style={{ marginTop: "var(--space-4)" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => void copyDiagnostics()}>
          <Icons.download size={14} /> {diagCopied ? "Copied!" : "Copy diagnostics"}
        </button>
        <p className="hint">Contains versions, settings and storage counts only — never incident details, names, contacts or coordinates.</p>
      </div>
      <div className="notice">
        <Icons.info size={18} />
        <span>
          This application records observations and handoffs. It is <strong>not</strong> veterinary software, does not give
          medical advice, and does not replace licensed wildlife professionals.
        </span>
      </div>
    </div>
  );
}
