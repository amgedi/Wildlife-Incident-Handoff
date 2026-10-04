/** Settings: left nav sections + right content, settings search, storage health. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { Segmented, TextField } from "../../components/ui";
import { Select } from "../../components/Select";
import { Dialog } from "../../components/Dialog";
import { downloadBackup, importBackup } from "../../storage/backupService";
import { getAllIncidents, getAllAttachmentBlobs, estimateStorage, setSetting, getSetting, putIncident } from "../../storage/repositories";
import { bytesToSize } from "../../utils/time";
import { APP_VERSION as appVersion, BUILD_ID as buildId, DATA_SCHEMA_VERSION as dataSchemaVersion, APP_LICENSE } from "../../version";
import { defaultUnitsFor } from "../../utils/units";
import { isTauri } from "../../utils/platformFile";
import { LANGUAGE_CATALOG, selectableLanguages, PSEUDO_LOCALE } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { DetailLevel, ExperienceMode, MotionPreference, ThemeName, NotificationPreferences } from "../../types/settings";
import { DEFAULT_NOTIFICATION_CATEGORIES } from "../../types/settings";
import { displayPhone, normalizePhoneForStorage, isValidPhone, parsePhone } from "../../utils/phone";
import { resetAllGuidance } from "../../features/tutorial/guidance";
import { getMapProviderDescriptor } from "../network/mapProvider";
import { ProfilePhoto, PHOTO_BORDER_STYLES } from "../../components/ProfilePhoto";
import { RoleCard } from "./RoleCard";
import { channelStatuses, requestWebNotificationPermission, webNotificationPermission, sendSystemNotification } from "../../notifications/delivery";
import {
  DEFAULT_LAN_SYNC_CONFIG, acceptPeerWithUnion, ensureDeviceIdentity, lanLocalAddress, lanPairPeer,
  lanSetPairingCode, lanSetTrusted, lanStart, lanStop, lanTakePairRequests, runSyncRound,
  lanSyncSupported, SYNC_CONFLICTS_KEY, type LanSyncConfig, type SyncConflict,
} from "../sync/lanSync";
import { PROFESSIONAL_ROLES, ROLE_VERIFICATION_REQUIREMENTS, type ProfessionalRole, type ProfessionalRoleEntry } from "../../features/network/authorization";
import { resetOnboardingForReplay, beginOnboardingPreview } from "../../features/onboarding/onboardingState";

const SECTIONS = [
  { id: "appearance", labelKey: "appearance", icon: Icons.eye, keywords: "theme appearance dark light density motion" },
  { id: "experience", labelKey: "experience", icon: Icons.compass, keywords: "experience mode detail level profile workspace" },
  { id: "accessibility", labelKey: "accessibility", icon: Icons.heart, keywords: "accessibility motion reduced contrast keyboard" },
  { id: "profile", labelKey: "profile", icon: Icons.user, keywords: "profile contact name phone email organization role country language" },
  { id: "defaults", labelKey: "defaults", icon: Icons.list, keywords: "incident defaults location precision name" },
  { id: "privacy", labelKey: "privacy", icon: Icons.shield, keywords: "privacy location contacts shareable" },
  { id: "storage", labelKey: "storage", icon: Icons.archive, keywords: "backup storage import export where is my data" },
  { id: "notifications", labelKey: "notifications", icon: Icons.bell, keywords: "notifications bell toasts quiet hours sound categories" },
  { id: "map", labelKey: "map", icon: Icons.map, keywords: "map tiles provider online offline test connection" },
  { id: "sync", labelKey: "sync", icon: Icons.handoff, keywords: "lan sync local network devices peer share wifi ethernet" },
  { id: "advanced", labelKey: "advanced", icon: Icons.settings, keywords: "advanced language region units reset factory replay onboarding tutorial testing" },
  { id: "about", labelKey: "about", icon: Icons.book, keywords: "about version license" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function StandaloneFallback({ section }: { section: SectionId }) {
  void section;
  return null;
}

export function SettingsPage({ standaloneSection }: { standaloneSection?: SectionId } = {}) {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("section") as SectionId | null;
  const validRequested = requested && SECTIONS.some((x) => x.id === requested) ? requested : null;
  const [section, setSection] = useState<SectionId>(standaloneSection ?? validRequested ?? "appearance");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (validRequested) setSection(validRequested);
  }, [validRequested]);

  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter((s) => s.labelKey.includes(q) || s.keywords.includes(q));
  }, [query]);

  const activeMeta = SECTIONS.find((s) => s.id === section)!;
  const ts = useTranslation("settings").t;

  // Standalone mode (e.g. /profile): one section, no rail, no search.
  if (standaloneSection) {
    return (
      <main className="content" id="main-content" style={{ maxWidth: 900 }}>
        <h1>{ts(standaloneSection, { defaultValue: standaloneSection })}</h1>
        {standaloneSection === "profile" && <ProfileSection />}
        {standaloneSection !== "profile" && <StandaloneFallback section={standaloneSection} />}
      </main>
    );
  }

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
          {section === "map" && <MapSection />}
          {section === "sync" && <LanSyncSection />}
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
  const [stats, setStats] = useState<{ incidents: number; attachments: number; usage: string; events: number; conflicts: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; warnings: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [incidents, blobs, est, conflicts] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs(), estimateStorage(), getSetting<unknown[]>(SYNC_CONFLICTS_KEY)]);
      setStats({
        incidents: incidents.length,
        attachments: blobs.length,
        events: incidents.reduce((n, i) => n + (i.timeline?.length ?? 0), 0),
        conflicts: conflicts?.length ?? 0,
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
          <>
            <dl className="kv">
              <dt>Incidents</dt><dd>{stats.incidents}</dd>
              <dt>Timeline events</dt><dd>{stats.events}</dd>
              <dt>Attachments</dt><dd>{stats.attachments}</dd>
              <dt>Local storage used</dt><dd>{stats.usage}</dd>
              <dt>Last backup</dt><dd>{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : "Never"}</dd>
              <dt>Unresolved sync conflicts</dt><dd>{stats.conflicts > 0 ? <span className="badge warn">{stats.conflicts}</span> : "0"}</dd>
            </dl>
            {settings.lastBackupAt && Date.now() - new Date(settings.lastBackupAt).getTime() > 14 * 86400000 && stats.incidents > 2 && (
              <p className="hint" style={{ color: "var(--c-warn)" }}>Backup is more than two weeks old — consider exporting a new one.</p>
            )}
          </>
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
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const prefs = settings.notifications;
  const setPrefs = (patch: Partial<NotificationPreferences>) => updateSettings({ notifications: { ...prefs, ...patch } });
  const setCategory = (id: string, on: boolean) =>
    setPrefs({ categories: { ...prefs.categories, [id]: on } });
  // dev.18: honest delivery channels — unsupported channels show why they are
  // unavailable instead of offering a placebo toggle (spec §37–§39).
  const channelList = channelStatuses();
  const channels = {
    system: channelList.find((c) => c.channel === "system")!,
    web: channelList.find((c) => c.channel === "web")!,
  };
  const testSystemDelivery = async (title: string, body: string): Promise<boolean> => sendSystemNotification(title, body);

  const reporterCategories = DEFAULT_NOTIFICATION_CATEGORIES.slice(0, 7);
  const professionalCategories = DEFAULT_NOTIFICATION_CATEGORIES.slice(7);

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("notifDelivery", { defaultValue: "Delivery" })}</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer" }}>
          <input type="checkbox" checked={prefs.inApp} onChange={(e) => setPrefs({ inApp: e.target.checked })} />
          {t("notifInApp", { defaultValue: "In-app notifications" })}
        </label>
        {channels.system.available && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.systemDelivery === true}
              onChange={(e) => {
                setPrefs({ systemDelivery: e.target.checked });
                if (e.target.checked) void testSystemDelivery(t("notifTestTitle", { defaultValue: "Wildlife Incident Handoff" }), t("notifTestBody", { defaultValue: "System notifications are on." }));
              }}
            />
            {t("notifSystem", { defaultValue: "Windows system notifications" })}
          </label>
        )}
        {channels.web.available && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.browser === true && webNotificationPermission() === "granted"}
              onChange={async (e) => {
                if (e.target.checked) {
                  // Permission is requested ONLY here, on explicit user action.
                  const perm = await requestWebNotificationPermission();
                  if (perm === "granted") {
                    setPrefs({ browser: true });
                    void sendSystemNotification(t("notifTestTitle", { defaultValue: "Wildlife Incident Handoff" }), t("notifTestBody", { defaultValue: "Browser notifications are on." }));
                  } else {
                    showToast(t("notifWebDenied", { defaultValue: "The browser did not grant notification permission." }));
                    setPrefs({ browser: false });
                  }
                } else {
                  setPrefs({ browser: false });
                }
              }}
            />
            {t("notifWeb", { defaultValue: "Browser notifications (this browser)" })}
          </label>
        )}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer" }}>
          <input type="checkbox" checked={prefs.sound} onChange={(e) => setPrefs({ sound: e.target.checked })} />
          {t("notifSound", { defaultValue: "Sound" })}
        </label>
        {!channels.system.available && (
          <p className="hint">{channels.system.reason === "desktop_only" ? t("notifSystemDesktopOnly", { defaultValue: "System notifications are available in the desktop app." }) : t("notifSystemUnavailable", { defaultValue: "System notifications are not available on this device." })}</p>
        )}
        {!channels.web.available && (
          <p className="hint">{t("notifWebUnavailable", { defaultValue: "Browser notifications are not available in this environment." })}</p>
        )}
        <p className="hint">{t("notifDeliveryHint", { defaultValue: "Notifications are generated locally from your own records. There is no push, email or server delivery." })}</p>
        <div className="row">
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const ok = prefs.systemDelivery === true || webNotificationPermission() === "granted"
                ? await testSystemDelivery(t("notifTestTitle", { defaultValue: "Wildlife Incident Handoff" }), t("notifTestBodySent", { defaultValue: "This is a real test notification." }))
                : false;
              showToast(ok ? t("notifTestSent", { defaultValue: "Test notification sent." }) : t("notifTestNotSent", { defaultValue: "Enable a system or browser notification channel first — the in-app preview is below." }));
            }}
          >
            {t("notifSendTest", { defaultValue: "Send test notification" })}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => showToast("This is what a notification looks like")}>
            {t("previewNotification", { defaultValue: "Preview in-app" })}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("notifCategories", { defaultValue: "Categories" })}</h3>
        <h4 style={{ marginBottom: 6 }}>{t("notifReporter", { defaultValue: "Reporter" })}</h4>
        {reporterCategories.map((id) => (
          <label key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer", marginBottom: 4 }}>
            <input type="checkbox" checked={prefs.categories[id] !== false} onChange={(e) => setCategory(id, e.target.checked)} />
            {t(`notifCat_${id}`, { defaultValue: NOTIF_CATEGORY_LABELS[id] ?? id })}
          </label>
        ))}
        <h4 style={{ margin: "var(--space-3) 0 6px" }}>{t("notifProfessional", { defaultValue: "Professional" })}</h4>
        {professionalCategories.map((id) => (
          <label key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer", marginBottom: 4 }}>
            <input type="checkbox" checked={prefs.categories[id] !== false} onChange={(e) => setCategory(id, e.target.checked)} />
            {t(`notifCat_${id}`, { defaultValue: NOTIF_CATEGORY_LABELS[id] ?? id })}
          </label>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("notifQuiet", { defaultValue: "Quiet hours" })}</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem", cursor: "pointer", marginBottom: 8 }}>
          <input type="checkbox" checked={prefs.quietHoursEnabled} onChange={(e) => setPrefs({ quietHoursEnabled: e.target.checked })} />
          {t("notifQuietEnable", { defaultValue: "Silence in-app notifications during quiet hours" })}
        </label>
        <div className="row" style={{ gap: 12 }}>
          <TextField type="time" label={t("notifQuietStart", { defaultValue: "Start" })} value={prefs.quietHoursStart} onChange={(v) => setPrefs({ quietHoursStart: v })} />
          <TextField type="time" label={t("notifQuietEnd", { defaultValue: "End" })} value={prefs.quietHoursEnd} onChange={(v) => setPrefs({ quietHoursEnd: v })} />
        </div>
        <p className="hint">{t("notifQuietHint", { defaultValue: "During quiet hours notifications are still recorded in the bell menu, but no toast appears." })}</p>
      </div>

      <div className="row">
        <button className="btn btn-secondary btn-sm" onClick={() => showToast("This is what a notification looks like")}>
          {t("previewNotification", { defaultValue: "Preview notification" })}
        </button>
      </div>
    </div>
  );
}

const NOTIF_CATEGORY_LABELS: Record<string, string> = {
  status_changed: "Report status changed",
  responder_assigned: "Responder assigned",
  information_requested: "Information requested",
  handoff_recorded: "Handoff recorded",
  resolved: "Resolved",
  draft_reminder: "Draft reminder",
  backup_reminder: "Backup reminder",
  new_in_service_area: "New incident in service area",
  assignment: "Assignment",
  unassigned_aging: "Unassigned incident aging",
  reporter_update: "Reporter update",
  handoff_waiting: "Handoff waiting",
  possible_duplicate: "Possible duplicate",
};

function MapSection() {
  const { settings, updateSettings } = useApp();
  const { t } = useTranslation("settings");
  const [testing, setTesting] = useState<"idle" | "testing" | "ok" | "failed">("idle");
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("mapProvider", { defaultValue: "Map provider" })}</h3>
        <dl className="kv">
          <dt>{t("mapCurrent", { defaultValue: "Provider" })}</dt><dd>{getMapProviderDescriptor("osm-raster").label} (MapLibre)</dd>
          <dt>{t("mapStatus", { defaultValue: "Status" })}</dt>
          <dd>{testing === "ok" ? <span className="badge open">{t("mapReachable", { defaultValue: "Reachable" })}</span> : testing === "failed" ? <span className="badge warn">{t("mapUnreachable", { defaultValue: "Unreachable" })}</span> : testing === "testing" ? "…" : "—"}</dd>
        </dl>
        <button
          className="btn btn-secondary btn-sm"
          disabled={testing === "testing"}
          onClick={async () => {
            setTesting("testing");
            try {
              const res = await fetch(getMapProviderDescriptor("osm-raster").healthCheckUrl ?? "", { method: "HEAD", mode: "cors" });
              setTesting(res.ok ? "ok" : "failed");
            } catch {
              setTesting("failed");
            }
          }}
        >
          <Icons.refresh size={14} /> {t("mapTest", { defaultValue: "Test connection" })}
        </button>
        <p className="hint">{t("mapPrivacyHint", { defaultValue: "When online maps are on, your map viewport (not your reports) is sent to the tile provider to draw the map. Incident coordinates are never uploaded." })}</p>
        <p className="hint" style={{ marginTop: 4 }}>{t("mapProviderPolicy", { defaultValue: getMapProviderDescriptor("osm-raster").usageNote })}</p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("mapOnline", { defaultValue: "Online maps" })}</h3>
        <Segmented
          label={t("mapOnline", { defaultValue: "Online maps" })}
          value={settings.mapTilesEnabled === false ? "off" : "on"}
          onChange={(v) => updateSettings({ mapTilesEnabled: v !== "off" })}
          options={[
            { value: "on", label: t("on", { defaultValue: "On" }) },
            { value: "off", label: t("off", { defaultValue: "Off" }) },
          ]}
        />
        <p className="hint">{t("mapOfflineHint", { defaultValue: "Off means maps show incident positions locally without downloading any tiles. Useful on metered connections or for maximum privacy." })}</p>
      </div>
    </div>
  );
}

function ResetAndTestingSection() {
  const { updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const [confirmFactory, setConfirmFactory] = useState(false);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("resetTitle", { defaultValue: "Reset & testing" })}</h3>
      <div className="stack" style={{ gap: "var(--space-3)" }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { resetOnboardingForReplay(); updateSettings({ onboarded: false }); }}>
            <Icons.refresh size={14} /> {t("resetReplay", { defaultValue: "Replay onboarding" })}
          </button>
          <p className="hint" style={{ width: "100%", margin: 0 }}>{t("resetReplayHint", { defaultValue: "Shows first-run setup again. Does not delete any reports." })}</p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={async () => { await resetAllGuidance(); showToast(t("resetTutorialsDone", { defaultValue: "Tutorial progress reset" })); }}>
            <Icons.refresh size={14} /> {t("resetTutorials", { defaultValue: "Reset tutorial progress" })}
          </button>
          <p className="hint" style={{ width: "100%", margin: 0 }}>{t("resetTutorialsHint", { defaultValue: "Resets the Interface Tour, Guide Me, Guided First Report and demo tutorial state. Does not delete incidents." })}</p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { beginOnboardingPreview(); updateSettings({ onboardingPreviewActive: true }); }}>
            <Icons.eye size={14} /> {t("resetPreviewFirstRun", { defaultValue: "Preview first-run experience" })}
          </button>
          <p className="hint" style={{ width: "100%", margin: 0 }}>{t("resetPreviewHint", { defaultValue: "Shows onboarding temporarily without modifying your saved settings or reports." })}</p>
        </div>
        <div className="notice warning">
          <Icons.warning size={18} />
          <span>
            {t("resetFactoryWarn", { defaultValue: "Factory reset permanently deletes ALL local application data — every incident, photo, draft and setting. There is no cloud copy." })}{" "}
            <strong>{t("resetFactoryBackupFirst", { defaultValue: "Create a backup first (Storage & backups)." })}</strong>
          </span>
        </div>
        {!confirmFactory ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmFactory(true)}>{t("resetFactory", { defaultValue: "Factory reset…" })}</button>
        ) : (
          <div className="row">
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                const { factoryReset } = await import("../../storage/factoryReset");
                await factoryReset();
              }}
            >
              <Icons.trash size={14} /> {t("resetFactoryConfirm", { defaultValue: "Yes, delete everything" })}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirmFactory(false)}>{t("cancel", { defaultValue: "Cancel" })}</button>
          </div>
        )}
      </div>
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
  const devPreview = settings.devPreviewLocales === true;
  // P21/P22: normal users only see languages that cover the whole interface.
  const complete = selectableLanguages(false);
  const beta = devPreview ? LANGUAGE_CATALOG.filter((l) => !l.selectable) : [];
  const pseudo = devPreview ? [PSEUDO_LOCALE] : [];
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
            {pseudo.map((code) => (
              <button
                key={code}
                role="option"
                aria-selected={settings.language === code}
                className={`language-option${settings.language === code ? " selected" : ""}`}
                onClick={() => updateSettings({ language: code })}
                title="Developer pseudo-locale — expands every string for layout testing"
              >
                <strong>[!!! Pseudo !!!]</strong>
                <span className="language-badge beta">zz-ZZ</span>
              </button>
            ))}
          </div>
          <p className="hint">{t("settings:languageHint")}</p>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem", cursor: "pointer", marginTop: 6 }}>
            <input
              type="checkbox"
              checked={devPreview}
              onChange={(e) => updateSettings({ devPreviewLocales: e.target.checked, language: !e.target.checked && !complete.some((l) => l.code === settings.language) ? "en" : settings.language })}
            />
            {t("settings:devPreviewLocales", { defaultValue: "Developer preview: show incomplete languages and the pseudo-locale" })}
          </label>
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
      <ResetAndTestingSection />
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

function ProfessionalRolesCard() {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation(["settings", "navigation"]);
  const roles = settings.professionalRoles ?? [];
  const [adding, setAdding] = useState(false);
  const [candidate, setCandidate] = useState<string>("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const active = settings.activeProfessionalRole;

  const addRole = () => {
    if (!candidate) return;
    // Local preview: adding a role NEVER marks it verified (P10).
    const entry: ProfessionalRoleEntry = { role: candidate as ProfessionalRole, state: "preview", addedAt: new Date().toISOString() };
    updateSettings({
      professionalRoles: [...roles, entry],
      activeProfessionalRole: settings.activeProfessionalRole ?? candidate,
    });
    setAdding(false);
    setCandidate("");
    showToast(t("settings:roleAddedPreview", { defaultValue: "Role added as a local preview role — not verified" }));
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.users size={18} /> {t("settings:profRolesTitle", { defaultValue: "Professional roles" })}
      </h3>
      <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
        {t("settings:profRolesBlurb", { defaultValue: "Roles tailor the professional workspace. Nothing here is verification — until a connected organization verifies you server-side, every role is labeled Professional Preview." })}
      </p>
      <div className="notice" style={{ margin: "var(--space-3) 0" }}>
        <Icons.shield size={16} />
        <span>{t("settings:profRolesPreview", { defaultValue: "All roles shown are Professional Preview (local). Verified roles will be issued by a real response organization." })}</span>
      </div>
      {roles.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {roles.map((r) => (
            <RoleCard key={r.role} entry={r} isActive={active === r.role} canDeactivate={active !== r.role && roles.length > 1} />
          ))}
        </div>
      )}
      {roles.length === 0 && (
        <p className="hint">{t("settings:profRolesEmpty", { defaultValue: "No professional roles added yet." })}</p>
      )}
      {!adding ? (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => { setAdding(true); setCandidate(PROFESSIONAL_ROLES.find((r) => !roles.some((x) => x.role === r)) ?? ""); }}>
          <Icons.plus size={14} /> {t("settings:roleAdd", { defaultValue: "Add professional role" })}
        </button>
      ) : (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Select
            label={t("settings:roleChoose", { defaultValue: "Which role are you adding?" })}
            value={candidate}
            options={PROFESSIONAL_ROLES.filter((r) => !roles.some((x) => x.role === r)).map((r) => ({
              value: r,
              label: t(`navigation:role_${r}`, { ns: "navigation", defaultValue: r.replaceAll("_", " ") }),
            }))}
            onChange={setCandidate}
          />
          <p className="hint">{t("settings:roleVerifyReq", { defaultValue: "Verification (connected mode): {{req}}", req: ROLE_VERIFICATION_REQUIREMENTS[candidate as keyof typeof ROLE_VERIFICATION_REQUIREMENTS] ?? "" })}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={addRole} disabled={!candidate}>{t("settings:roleAddConfirm", { defaultValue: "Add role" })}</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setAdding(false)}>{t("settings:cancel", { defaultValue: "Cancel" })}</button>
          </div>
        </div>
      )}
      <Dialog
        open={confirmRemove !== null}
        title={t("settings:roleRemoveTitle", { defaultValue: "Remove professional role?" })}
        onClose={() => setConfirmRemove(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmRemove(null)}>{t("settings:cancel", { defaultValue: "Cancel" })}</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                const next = roles.filter((r) => r.role !== confirmRemove);
                updateSettings({
                  professionalRoles: next,
                  activeProfessionalRole: active === confirmRemove ? (next[0]?.role ?? null) : active,
                });
                setConfirmRemove(null);
                showToast(t("settings:roleRemoved", { defaultValue: "Role removed" }));
              }}
            >
              {t("settings:roleRemoveConfirm", { defaultValue: "Remove role" })}
            </button>
          </>
        }
      >
        <p>{t("settings:roleRemoveBody", { defaultValue: "This removes the role from your local workspace. It does not delete any incidents. You can add it back later." })}</p>
      </Dialog>
    </div>
  );
}

function ProfileSection() {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("photoNotImage", { defaultValue: "That file is not an image" }));
      return;
    }
    // Downscale to a small square data URL (keeps local storage light).
    const bitmap = await createImageBitmap(file);
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    ctx.drawImage(bitmap, (size - bitmap.width * scale) / 2, (size - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    updateSettings({ profilePhoto: canvas.toDataURL("image/jpeg", 0.85) });
    showToast(t("photoSaved", { defaultValue: "Profile picture saved" }));
  }

  const saved = settings.savedReporterContact;
  const [draft, setDraft] = useState({
    name: saved?.name ?? "",
    phone: saved?.phone ?? "",
    email: saved?.email ?? "",
    preferred: saved?.preferred ?? "no_preference",
    organization: saved?.organization ?? "",
    role: saved?.role ?? "",
  });
  const parsed = draft.phone.trim() ? parsePhone(draft.phone, settings.country) : null;

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.user size={18} /> {t("profileTitle", { defaultValue: "Your profile" })}
        </h3>
        <p style={{ color: "var(--c-ink-soft)" }}>
          {t("profileBlurb", { defaultValue: "Saved details pre-fill new reports for convenience. You always choose whether they are actually included when creating or sharing a report — nothing is sent, shared or submitted automatically." })}
        </p>
        <div className="notice" style={{ margin: "var(--space-3) 0" }}>
          <Icons.shield size={16} />
          <span>{t("profileLocal", { defaultValue: "Stored locally on this device. Pre-fills reports only — final report privacy controls decide what is shared." })}</span>
        </div>
        <div className="row" style={{ gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center", margin: "var(--space-3) 0" }} data-testid="profile-photo">
          <ProfilePhoto src={settings.profilePhoto} size={72} border={settings.photoBorder} title={t("profileTitle", { defaultValue: "Your profile" })} />
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => photoInputRef.current?.click()}>
                {settings.profilePhoto ? t("photoChange", { defaultValue: "Change picture" }) : t("photoUpload", { defaultValue: "Add a picture" })}
              </button>
              {settings.profilePhoto && (
                <button className="btn btn-quiet btn-sm" onClick={() => updateSettings({ profilePhoto: null })}>
                  {t("photoRemove", { defaultValue: "Remove" })}
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => void handlePhotoChange(e)}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label={t("photoBorder", { defaultValue: "Picture border style" })}>
              {PHOTO_BORDER_STYLES.map((style) => (
                <button
                  key={style}
                  className="chip"
                  aria-pressed={settings.photoBorder === style}
                  onClick={() => updateSettings({ photoBorder: style })}
                >
                  {t(`photoBorder_${style}`, {
                    defaultValue: ({ none: "Plain", leaves: "Leaves", wood: "Wood", rope: "Rope", stars: "Stars" } as Record<string, string>)[style] ?? style,
                  })}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: 0 }}>{t("photoHint", { defaultValue: "Shown only in your sidebar, on this device." })}</p>
          </div>
        </div>
        <div className="grid-2">
          <TextField label={t("profileName", { defaultValue: "Name" })} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} optional />
          <TextField label={t("profileOrg", { defaultValue: "Organization (optional)" })} value={draft.organization} onChange={(v) => setDraft({ ...draft, organization: v })} optional />
          <TextField label={t("profileRole", { defaultValue: "Role (optional)" })} value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} optional hint={t("profileRoleHint", { defaultValue: "e.g. Volunteer transport, Rehabilitator, Ranger" })} />
          <Select
            label={t("profileCountry", { defaultValue: "Country or region" })}
            value={settings.country}
            options={COUNTRIES}
            onChange={(v) => updateSettings({ country: v })}
            optional
          />
          <div>
            <TextField
              label={t("profilePhone", { defaultValue: "Phone" })}
              type="tel"
              value={draft.phone}
              onChange={(v) => setDraft({ ...draft, phone: v })}
              optional
              hint={parsed?.valid ? parsed.display ?? undefined : t("profilePhoneHint", { defaultValue: "Any international format, e.g. +44 7700 900123 or 07700 900123" })}
            />
            {parsed && !parsed.valid && draft.phone.trim().length > 3 && (
              <p className="hint" style={{ color: "var(--c-warn, #b8860b)" }}>{t("profilePhoneUnknown", { defaultValue: "Will be saved exactly as typed — it doesn't look like a complete international number." })}</p>
            )}
          </div>
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
              const has = draft.name || draft.phone || draft.email || draft.organization || draft.role;
              const normalized = { ...draft, phone: normalizePhoneForStorage(draft.phone, settings.country) };
              updateSettings({ savedReporterContact: has ? normalized : null });
              if (has) void setSetting("saved-reporter-contact", normalized);
              else void setSetting("saved-reporter-contact", null);
              showToast(t("profileSaved", { defaultValue: "Profile saved" }));
            }}
          >
            {t("profileSave", { defaultValue: "Save profile" })}
          </button>
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setDraft({ name: "", phone: "", email: "", preferred: "no_preference", organization: "", role: "" });
              updateSettings({ savedReporterContact: null });
              void setSetting("saved-reporter-contact", null);
              showToast(t("profileCleared", { defaultValue: "Saved profile cleared" }));
            }}
          >
            <Icons.trash size={14} /> {t("profileClear", { defaultValue: "Clear" })}
          </button>
        </div>
        {saved?.phone && isValidPhone(saved.phone) && (
          <p className="hint" style={{ marginTop: "var(--space-2)" }}>
            {t("profileStoredPhone", { defaultValue: "Stored phone (normalized):" })} {displayPhone(saved.phone)}
          </p>
        )}
      </div>
      {settings.workspace === "professional" && <ProfessionalRolesCard />}
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


// ---- LAN sync (0.2.0-dev.13): local-network incident exchange --------------

const LAN_SYNC_CONFIG_KEY = "lan-sync-config";

function LanSyncSection() {
  const { showToast, settings: appSettings, notify } = useApp();
  const { t } = useTranslation("settings");
  const supported = lanSyncSupported();
  const [config, setConfig] = useState<LanSyncConfig>(DEFAULT_LAN_SYNC_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [identity, setIdentity] = useState<{ deviceId: string; deviceLabel: string }>({ deviceId: "", deviceLabel: "" });
  const [address, setAddress] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairAddressInput, setPairAddressInput] = useState("");
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [pairRequests, setPairRequests] = useState<Array<{ deviceId: string; name: string; address?: string }>>([]);
  const [trustedDevices, setTrustedDevices] = useState<Array<{ id: string; name: string }>>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    getSetting<LanSyncConfig>(LAN_SYNC_CONFIG_KEY).then((saved) => {
      if (saved && typeof saved.port === "number") setConfig({ ...DEFAULT_LAN_SYNC_CONFIG, ...saved, peers: Array.isArray(saved.peers) ? saved.peers : [] });
      setLoaded(true);
    });
    void ensureDeviceIdentity().then(setIdentity);
  }, []);

  // Server + sync loop lifecycle.
  useEffect(() => {
    if (!supported || !loaded || !config.enabled) return;
    let cancelled = false;
    const addLog = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()} — ${line}`, ...l].slice(0, 8));
    (async () => {
      try {
        await lanStart(config.port);
        setAddress(await lanLocalAddress(config.port));
        // Re-register trusted device ids with the server after (re)start.
        const trusted = (await getSetting<Array<{ id: string; name: string }>>("lan-sync-trusted")) ?? [];
        await lanSetTrusted(trusted.map((d) => d.id));
        // A fresh pairing code per session; shown to the user to give out.
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        setPairingCode(code);
        await lanSetPairingCode(code);
        addLog(t("syncStartedLog", { defaultValue: "LAN sync server started" }));
        while (!cancelled) {
          const r = await runSyncRound(
            config,
            appSettings.displayName || appSettings.professionalProfile?.name || "Device",
            identity.deviceId || (await ensureDeviceIdentity()).deviceId,
            addLog
          );
          if (r.added > 0 || r.updated > 0 || r.peersUp > 0) setLastSync(new Date().toISOString());
          const nextConflicts = ((await getSetting<SyncConflict[]>(SYNC_CONFLICTS_KEY)) ?? []).slice(-20);
          setConflicts(nextConflicts);
          setTrustedDevices((await getSetting<Array<{ id: string; name: string }>>("lan-sync-trusted")) ?? []);
          const reqs = await lanTakePairRequests();
          if (reqs.length > 0) {
            const parsed = reqs
              .map((body) => {
                try {
                  return JSON.parse(body) as { deviceId: string; name: string; address?: string };
                } catch {
                  return null;
                }
              })
              .filter((x): x is { deviceId: string; name: string; address?: string } => !!x);
            setPairRequests((prev) => [...prev, ...parsed.filter((p) => !prev.some((q) => q.deviceId === p.deviceId))]);
            void notify({
              category: "sync_conflict",
              title: t("syncPairRequest", { defaultValue: "Pairing request" }),
              body: t("syncPairRequestBody", { defaultValue: "A device wants to sync with this one. Review it in Settings → LAN sync." }),
            });
          }
          await new Promise((res) => setTimeout(res, 5000));
        }
      } catch (e) {
        addLog(`error: ${String(e).slice(0, 90)}`);
      }
    })();
    return () => {
      cancelled = true;
      void lanStop();
    };
    // The loop restarts when config or identity changes.
  }, [supported, loaded, config.enabled, config.port, config.peers, identity.deviceId]);

  const saveConfig = (next: LanSyncConfig) => {
    setConfig(next);
    void setSetting(LAN_SYNC_CONFIG_KEY, next);
  };

  const trustDevice = async (req: { deviceId: string; name: string; address?: string }) => {
    const trusted = (await getSetting<Array<{ id: string; name: string }>>("lan-sync-trusted")) ?? [];
    const next = [...trusted.filter((d) => d.id !== req.deviceId), { id: req.deviceId, name: req.name }];
    await setSetting("lan-sync-trusted", next);
    setTrustedDevices(next);
    await lanSetTrusted(next.map((d) => d.id));
    if (req.address && !config.peers.includes(req.address)) {
      saveConfig({ ...config, peers: [...config.peers, req.address] });
    }
    setPairRequests((prev) => prev.filter((p) => p.deviceId !== req.deviceId));
    showToast(t("syncTrustedToast", { defaultValue: "Device trusted" }));
  };

  const revokeTrust = async (id: string) => {
    const trusted = (await getSetting<Array<{ id: string; name: string }>>("lan-sync-trusted")) ?? [];
    const next = trusted.filter((d) => d.id !== id);
    await setSetting("lan-sync-trusted", next);
    setTrustedDevices(next);
    await lanSetTrusted(next.map((d) => d.id));
    showToast(t("syncRevokedToast", { defaultValue: "Trust removed — that device can no longer sync until re-paired" }));
  };

  const resolveConflict = async (conflict: SyncConflict, choice: "mine" | "theirs" | "both") => {
    if (choice === "theirs") {
      await putIncident(acceptPeerWithUnion(conflict.local, conflict.incoming, { deviceId: conflict.peerDeviceId, name: conflict.peerName }));
    } else if (choice === "both") {
      await putIncident({
        ...conflict.incoming,
        id: crypto.randomUUID?.() ?? `copy-${Date.now()}`,
        humanReference: conflict.incoming.humanReference + "-COPY",
        syncSource: { deviceId: conflict.peerDeviceId, name: conflict.peerName, at: new Date().toISOString() },
      });
    }
    // The resolution itself is recorded as another event on the surviving record.
    const survivor = choice === "theirs" ? conflict.incoming : conflict.local;
    const choiceText =
      choice === "mine"
        ? t("syncKeptMine", { defaultValue: "this device's version" })
        : choice === "theirs"
          ? t("syncKeptTheirs", { defaultValue: "the peer device's version", interpolation: { escapeValue: false } })
          : t("syncKeptBoth", { defaultValue: "both (a copy of the peer version was kept)" });
    await putIncident({
      ...survivor,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...survivor.timeline,
        {
          eventId: crypto.randomUUID?.() ?? `e-${Date.now()}`,
          incidentId: survivor.id,
          eventType: "field_corrected" as const,
          timestamp: new Date().toISOString(),
          actor: appSettings.displayName || null,
          summary: t("syncConflictResolved", { defaultValue: "Sync conflict resolved — kept {{choice}}", choice: choiceText, interpolation: { escapeValue: false } }),
          details: null,
          metadata: null,
          relatedAttachmentIds: [],
        },
      ],
    });
    const next = conflicts.filter((c) => c.id !== conflict.id);
    setConflicts(next);
    await setSetting(SYNC_CONFLICTS_KEY, next);
    showToast(t("syncConflictResolvedToast", { defaultValue: "Conflict resolved and recorded" }));
  };

  if (!supported) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("syncTitle", { defaultValue: "LAN sync" })}</h3>
        <p className="hint">{t("syncUnavailableBrowser", { defaultValue: "LAN sync runs in the desktop (Windows) app only — the browser/PWA build has no local server. Install the desktop version to sync devices on the same network." })}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>
        {t("syncTitle", { defaultValue: "LAN sync" })}{" "}
        <span className="badge warn" style={{ verticalAlign: "middle" }}>{t("syncExperimental", { defaultValue: "EXPERIMENTAL" })}</span>
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        {t("syncBlurb", {
          defaultValue: "Sync incident records with other computers running this app on the same local network. No internet, no cloud — devices talk directly to each other.",
        })}
      </p>
      <p className="hint" style={{ marginTop: 0 }}>
        {t("syncExperimentalWarning", {
          defaultValue: "Experimental: traffic between devices is not encrypted yet, and device identity is not cryptographically verified. Use only on networks you fully trust (for example your own home or office network), with people you trust. Off by default.",
        })}
      </p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "var(--space-3) 0", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => {
            saveConfig({ ...config, enabled: e.target.checked });
            showToast(e.target.checked ? t("syncEnabledToast", { defaultValue: "LAN sync enabled" }) : t("syncDisabledToast", { defaultValue: "LAN sync disabled" }));
          }}
        />
        <strong>{t("syncEnable", { defaultValue: "Sync with devices on this network" })}</strong>
      </label>
      {config.enabled && (
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          <dl className="kv">
            <dt>{t("syncAddress", { defaultValue: "Your address (share with other devices)" })}</dt>
            <dd><code>{address ?? "…"}</code></dd>
            <dt>{t("syncPairingCode", { defaultValue: "Your pairing code" })}</dt>
            <dd><code style={{ fontWeight: 700, letterSpacing: "0.1em" }}>{pairingCode || "…"}</code></dd>
            <dt>{t("syncLastSync", { defaultValue: "Last exchange" })}</dt>
            <dd>{lastSync ? new Date(lastSync).toLocaleTimeString() : t("never", { defaultValue: "Never" })}</dd>
          </dl>

          {pairRequests.length > 0 && (
            <div className="notice warning" role="status">
              <strong>{t("syncPairRequests", { defaultValue: "Pairing requests" })}</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {pairRequests.map((r) => (
                  <li key={r.deviceId} className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span>{r.name || r.deviceId.slice(0, 8)}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => void trustDevice(r)}>{t("syncTrust", { defaultValue: "Trust device" })}</button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setPairRequests((prev) => prev.filter((p) => p.deviceId !== r.deviceId))}>{t("syncDeny", { defaultValue: "Deny" })}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="notice warning">
              <strong>{t("syncConflicts", { defaultValue: "Sync conflicts need review" })} ({conflicts.length})</strong>
              <p className="hint" style={{ margin: "4px 0 8px" }}>{t("syncConflictsHint", { defaultValue: "Both devices changed these records since the last sync. Nothing was overwritten — choose what to keep." })}</p>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {conflicts.map((c) => (
                  <li key={c.id} style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 8, background: "var(--c-surface)" }}>
                    <strong>{c.reference}</strong> <span className="hint" style={{ margin: 0 }}>· {c.peerName}</span>
                    <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => void resolveConflict(c, "mine")}>{t("syncUseMine", { defaultValue: "Use this device's" })}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => void resolveConflict(c, "theirs")}>{t("syncUseTheirs", { defaultValue: "Use the peer's", interpolation: { escapeValue: false } })}</button>
                      <button className="btn btn-quiet btn-sm" onClick={() => void resolveConflict(c, "both")}>{t("syncKeepBoth", { defaultValue: "Keep both" })}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="field">
            <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{t("syncAddPeer", { defaultValue: "Pair with a device" })}</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="http://192.168.1.20:47618"
                value={pairAddressInput}
                onChange={(e) => setPairAddressInput(e.target.value)}
                aria-label={t("syncPeerAddress", { defaultValue: "Device address" })}
              />
              <input
                className="input"
                style={{ maxWidth: 110 }}
                placeholder={t("syncPeerCode", { defaultValue: "Their code" })}
                value={pairCodeInput}
                onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                aria-label={t("syncPeerCode", { defaultValue: "Their code" })}
              />
              <button
                className="btn btn-secondary btn-sm"
                disabled={!/^http:\/\/.+/.test(pairAddressInput.trim()) || pairCodeInput.trim().length < 4}
                onClick={async () => {
                  try {
                    const addr = pairAddressInput.trim().replace(/\/$/, "");
                    await lanPairPeer(addr, identity.deviceId, appSettings.displayName || "Device", pairCodeInput.trim());
                    if (!config.peers.includes(addr)) saveConfig({ ...config, peers: [...config.peers, addr] });
                    setPairCodeInput("");
                    setPairAddressInput("");
                    showToast(t("syncPairRequested", { defaultValue: "Pairing sent — if they accept, sync starts automatically" }));
                  } catch {
                    showToast(t("syncPairFailed", { defaultValue: "Pairing failed — check the address and code" }));
                  }
                }}
              >
                {t("syncPairBtn", { defaultValue: "Pair" })}
              </button>
            </div>
            <p className="hint">{t("syncPeerHint", { defaultValue: "Both devices must be running with LAN sync enabled. Show your pairing code, enter theirs — each side confirms the other." })}</p>
          </div>

          {trustedDevices.length > 0 && (
            <div>
              <strong style={{ fontSize: "0.85rem" }}>{t("syncTrustedDevices", { defaultValue: "Trusted devices" })}</strong>
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 4 }}>
                {trustedDevices.map((d) => (
                  <li key={d.id} className="row between" style={{ padding: "6px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)" }}>
                    <span>{d.name || d.id.slice(0, 8)}</span>
                    <button className="btn btn-quiet btn-sm" onClick={() => void revokeTrust(d.id)}>{t("syncRemoveTrust", { defaultValue: "Remove trust" })}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <strong style={{ fontSize: "0.85rem" }}>{t("syncActivity", { defaultValue: "Activity" })}</strong>
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 2 }}>
              {log.length === 0 && <li className="hint">{t("syncQuiet", { defaultValue: "Waiting for changes…" })}</li>}
              {log.map((line, i) => (
                <li key={i} style={{ fontSize: "0.8rem", color: "var(--c-ink-soft)" }}>{line}</li>
              ))}
            </ul>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {t("syncMediaNote", { defaultValue: "v2 syncs incident records (text, timeline, contacts, privacy settings). Photo and video files are not synced yet — use backups to move media." })}
            {" "}
            {t("syncTrustNote", { defaultValue: "Only pair devices you trust: a paired device receives full records, including private notes." })}
          </p>
        </div>
      )}
    </div>
  );
}
