/**
 * Help Center (0.2.0-dev.7): replaces the "Examples & Tutorial" page as the
 * primary help experience. Role-aware sections (Reporter / Professional),
 * Tutorials, Glossary (single source) and Support with a privacy-safe
 * diagnostics bundle.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { GLOSSARY_TERMS } from "./glossary";
import { APP_VERSION, BUILD_ID, DATA_SCHEMA_VERSION, APP_LICENSE } from "../../version";
import { isTauri } from "../../utils/platformFile";
import { getAllIncidents, getAllAttachmentBlobs, estimateStorage } from "../../storage/repositories";
import { bytesToSize } from "../../utils/time";

type HelpRole = "reporter" | "professional";

const REPORTER_TOPICS = [
  { id: "howToReport", title: "How to report wildlife", body: "Open Report wildlife and answer the short steps. Everything is optional except your final confirmation — describe what you actually saw." },
  { id: "safety", title: "Safety first", body: "Observe from a safe distance, keep people and pets away, avoid handling the animal, and contact local professionals when needed." },
  { id: "describe", title: "Describe what you see", body: "Exact words beat guesses: “right wing hangs lower” is more useful than a diagnosis. Unknown is a valid answer everywhere." },
  { id: "location", title: "Location", body: "Use your device location (with confirmation), drop a pin, or type a description. Choose exact, approximate or sensitive precision per report." },
  { id: "media", title: "Photos and videos", body: "Attach photos and short videos from the Attachments step or the incident's Attachments tab. Media is stored locally on this device." },
  { id: "update", title: "Update a report", body: "Open the report and use Update report. Updates join the timeline — history is never overwritten." },
  { id: "privacy", title: "Privacy", body: "Everything is stored locally on this device. Nothing is uploaded unless you explicitly export or share." },
  { id: "statuses", title: "What report statuses mean", body: "See Help → Glossary for each status. Awaiting response means professionals have not picked it up yet; Resolved means the case is closed." },
  { id: "backups", title: "Backups", body: "Settings → Storage & backups creates a single JSON file with all incidents and media. Keep regular backups — there is no cloud copy." },
  { id: "troubleshooting", title: "Troubleshooting", body: "If something looks wrong: check Settings → Map for tile status, try a refresh, and copy diagnostics from Settings → About before reporting a bug." },
];

const PROFESSIONAL_TOPICS = [
  { id: "dashboard", title: "Dashboard", body: "The operations dashboard shows Needs Attention, live KPIs, the activity feed, case aging and analytics — all derived only from local records." },
  { id: "network", title: "Response network", body: "Currently a Local Professional Preview: the registry is fictional and nothing is transmitted. See docs/NETWORK_SECURITY_AND_AUTH_PLAN.md for the plan." },
  { id: "assignments", title: "Assignments", body: "Accept a new incident from the dashboard feed or assign from the incident's People tab. Status changes are recorded with structured timeline events." },
  { id: "map", title: "Map", body: "The map shows incident markers with privacy-aware fuzzing. If tiles fail, use Retry or the local position fallback; provider status lives in Settings → Map." },
  { id: "intake", title: "Professional intake", body: "New incident in professional mode records source, professional assessment, custody and organization fields without rewriting the reporter's original observations." },
  { id: "custody", title: "Custody", body: "Every custody change appends to the custody chain. Handoffs close the previous holder's entry and start a new one." },
  { id: "handoffs", title: "Handoffs", body: "Record the transfer, receiving party and condition notes. Handoff analytics show waits and receiving organizations." },
  { id: "analytics", title: "Analytics", body: "Metrics prefer structured timeline event metadata; older records fall back to text parsing. Insufficient data shows “Not enough data yet”, never zero." },
  { id: "privacyAccess", title: "Privacy and access", body: "Professional tools do not bypass privacy: sensitive locations are fuzzed, and shareable exports still honor each report's sharing profile." },
  { id: "verification", title: "Verification", body: "Local workspace choice is not verification. Until a server-backed system exists, everyone is “Professional Preview” — never an authenticated responder." },
  { id: "troubleshooting", title: "Troubleshooting", body: "Check Settings → Map → Test connection for tile issues, review diagnostics in Settings → About, and see Support below for reporting bugs." },
];

export function HelpPage() {
  const { settings } = useApp();
  const { t, i18n } = useTranslation(["help", "glossary"]);
  const navigate = useNavigate();
  const [role, setRole] = useState<HelpRole>(settings.workspace);
  const [query, setQuery] = useState("");
  const [showGlossary, setShowGlossary] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);

  const topics = role === "professional" ? PROFESSIONAL_TOPICS : REPORTER_TOPICS;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((tp) => tp.title.toLowerCase().includes(q) || tp.body.toLowerCase().includes(q));
  }, [query, topics]);

  async function copyDiagnostics() {
    const [incidents, blobs, est] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs(), estimateStorage()]);
    const lines = [
      "Wildlife Incident Handoff — support diagnostics",
      `applicationVersion: ${APP_VERSION}`,
      `buildId: ${BUILD_ID}`,
      `dataSchemaVersion: ${DATA_SCHEMA_VERSION}`,
      `license: ${APP_LICENSE}`,
      `platform: ${isTauri() ? "desktop (Tauri)" : "web/PWA"}`,
      `workspace: ${settings.workspace}`,
      `language: ${settings.language}`,
      `theme: ${settings.theme} / motion: ${settings.motion} / ambient: ${settings.ambient}`,
      `incidents: ${incidents.length}`,
      `attachments: ${blobs.length}`,
      `storageUsage: ${est ? bytesToSize(est.usage) : "not reported"}`,
      `online: ${navigator.onLine}`,
      "", 
      "Privacy note: this bundle intentionally contains NO incident details, contact info, coordinates or media.",
    ].join(String.fromCharCode(10));
    await navigator.clipboard.writeText(lines);
    setDiagCopied(true);
    setTimeout(() => setDiagCopied(false), 2500);
  }

  return (
    <main className="content" id="main-content" style={{ maxWidth: 1080 }}>
      <h1>{t("help:title", { defaultValue: "Help center" })}</h1>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <div className="segmented" role="tablist" aria-label={t("help:role", { defaultValue: "Help for" })}>
          <button role="tab" aria-selected={role === "reporter"} className={role === "reporter" ? "active" : ""} onClick={() => setRole("reporter")}>
            {t("help:reporter", { defaultValue: "Reporter help" })}
          </button>
          <button role="tab" aria-selected={role === "professional"} className={role === "professional" ? "active" : ""} onClick={() => setRole("professional")}>
            {t("help:professional", { defaultValue: "Professional help" })}
          </button>
        </div>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          type="search"
          placeholder={t("help:searchPlaceholder", { defaultValue: "Search help" })}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("help:searchPlaceholder", { defaultValue: "Search help" })}
        />
      </div>

      <section aria-label={t("help:topics", { defaultValue: "Topics" })} className="help-topics">
        {filtered.map((tp) => (
          <div key={tp.id} className="card" style={{ padding: "var(--space-4)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{tp.title}</h3>
            <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{tp.body}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="hint">{t("help:noResults", { defaultValue: "No matching topics. Try another search or check the glossary." })}</p>}
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <h2>{t("help:tutorialsTitle", { defaultValue: "Tutorials" })}</h2>
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("help:tutorialTour", { defaultValue: "Take the tour" })}</h3>
            <p className="hint">{t("help:tutorialTourHint", { defaultValue: "A guided spotlight tour of the main interface." })}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")}>{t("help:goHomeForTour", { defaultValue: "Start from Home" })}</button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("help:tutorialFirst", { defaultValue: "Report your first animal" })}</h3>
            <p className="hint">{t("help:tutorialFirstHint", { defaultValue: "A step-by-step guided first report." })}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/tutorial")}>{t("help:openTutorial", { defaultValue: "Open tutorial" })}</button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("help:tutorialExamples", { defaultValue: "Practice with a fictional demo" })}</h3>
            <p className="hint">{t("help:tutorialExamplesHint", { defaultValue: "Explore example incidents clearly marked FICTIONAL DEMO — nothing touches your records." })}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/examples")}>{t("help:openExamples", { defaultValue: "Open examples" })}</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>{t("glossaryTitle", { ns: "help", defaultValue: "Glossary" })}</h2>
          <button className="btn btn-secondary btn-sm" aria-expanded={showGlossary} onClick={() => setShowGlossary((v) => !v)}>
            {showGlossary ? t("common:hide", { defaultValue: "Hide" }) : t("common:show", { defaultValue: "Show" })}
          </button>
        </div>
        {showGlossary && (
          <dl className="kv" style={{ marginTop: "var(--space-3)" }}>
            {GLOSSARY_TERMS.map((term) => (
              <div key={term} style={{ marginBottom: 10 }}>
                <dt style={{ fontWeight: 650 }}>{t(`glossary:${term}_term`, { defaultValue: term })}</dt>
                <dd style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{t(`glossary:${term}`, { defaultValue: "" })}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <h2>{t("help:supportTitle", { defaultValue: "Support" })}</h2>
        <div className="card">
          <p style={{ color: "var(--c-ink-soft)" }}>{t("help:supportIntro", { defaultValue: "Found a bug or missing something? Please include the privacy-safe diagnostics below (never incident details, contacts or coordinates)." })}</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void copyDiagnostics()}>
              <Icons.download size={14} /> {diagCopied ? t("help:copied", { defaultValue: "Copied!" }) : t("help:copyDiagnostics", { defaultValue: "Copy diagnostics" })}
            </button>
            <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff/issues" target="_blank" rel="noreferrer">
              {t("help:reportBug", { defaultValue: "Report a bug" })}
            </a>
            <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff/discussions" target="_blank" rel="noreferrer">
              {t("help:requestFeature", { defaultValue: "Request a feature" })}
            </a>
            <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff" target="_blank" rel="noreferrer">
              {t("help:repository", { defaultValue: "GitHub repository" })}
            </a>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {t("help:versionLine", { defaultValue: "Version {{version}} · {{license}}", version: APP_VERSION, license: APP_LICENSE })} · {i18n.language}
          </p>
        </div>
      </section>
      <style>{`.help-topics{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)}`}</style>
    </main>
  );
}
