/**
 * Help Center (0.2.0-dev.8): real category/article layout.
 * - Reporters see ONLY reporter help (no professional tab).
 * - Professionals may switch between Professional and Reporter help.
 * - Articles open in a reading pane; no fixed heights that clip copy.
 * - Support is an honest local composer: no fake "message sent" — it
 *   prepares/copies/downloads a privacy-safe request bundle.
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
import { Select } from "../../components/Select";
import { TextField } from "../../components/ui";
import { startGuidedTour } from "./tours";
import type { Workspace } from "../../types/settings";

interface Article {
  id: string;
  category: string;
  title: string;
  body: string;
  /** Optional tutorial to launch with [Show me]. */
  tour?: "interface" | "first-report";
}

const REPORTER_ARTICLES: Article[] = [
  { id: "getting-started", category: "gettingStarted", title: "Getting started", body: "Wildlife Incident Handoff stores everything on this device — no account needed. Start from Home: the safety card tells you what to do first, then choose Report wildlife. Everything except your final confirmation is optional; Unknown is always a valid answer." },
  { id: "how-to-report", category: "reporting", title: "How to report wildlife", body: "Open Report wildlife and answer the short steps: what happened, the animal, where, what you observed, hazards, what you already did, where the animal is now, contacts, and photos. Review the summary, choose what to include, and create the report. A draft is saved automatically as you go." },
  { id: "safety", category: "safety", title: "Safety first", body: "Observe from a safe distance, keep people and pets away where possible, avoid unnecessary handling, and contact an appropriate local professional when needed. This app records information — it is not veterinary advice and never replaces licensed professionals." },
  { id: "describe", category: "reporting", title: "Describe what you see", body: "Exact words beat guesses: \u201cright wing hangs lower\u201d is more useful than a diagnosis. Species, age and cause can all be Unknown — guessing can misdirect response. The app never treats a typed species as verified; professionals can correct it later and the original entry stays in history." },
  { id: "location", category: "location", title: "Location", body: "Use your device location (you confirm the captured position before it is applied), drop coordinates manually, or type a description. Choose exact, approximate or sensitive precision per report. A human-readable description is often more useful than coordinates." },
  { id: "media", category: "media", title: "Photos and videos", body: "Attach photos and short videos (MP4, WebM, MOV) from the media step or the incident's Attachments tab. Media is stored locally on this device, captions are optional, and nothing plays automatically. Very large videos warn you first — local storage is finite." },
  { id: "update", category: "reporting", title: "Update a report", body: "Open the report and use Update report. Updates join the timeline — history is never overwritten, so the story stays traceable from first observation to closure." },
  { id: "privacy", category: "privacy", title: "Privacy", body: "Everything is stored locally in this browser on this device. Nothing is uploaded anywhere. You choose what to include each time you create or share a report, and every export shows exactly what it contains before you save or print it." },
  { id: "statuses", category: "statuses", title: "What report statuses mean", body: "Awaiting response: professionals have not picked it up yet. Responder assigned: someone accepted. Awaiting pickup / In transport: the animal is being collected or moved. In care / Transferred: a facility holds the animal. Released, Deceased, Closed: resolved outcomes. See the Glossary for full definitions." },
  { id: "backups", category: "backups", title: "Backups", body: "Settings → Storage & backups creates a single JSON file with all incidents and media. Keep regular backups — there is no cloud copy, and clearing browser site data deletes local records." },
  { id: "troubleshooting", category: "troubleshooting", title: "Troubleshooting", body: "If maps fail, check Settings → Map → Test connection. If a section looks broken, the built-in error screen offers Retry and Copy diagnostics. For anything else, see Support below." },
  { id: "q-account", category: "gettingStarted", title: "Do I need an account?", body: "No. There is no sign-up, no login and no server. The app works entirely from this browser on this device — open it and start recording. That also means clearing your browser's site data deletes your records, so keep backups." },
  { id: "q-danger", category: "safety", title: "What if the animal is in immediate danger?", body: "Treat people first: move somewhere safe away from traffic, water or the animal. Then record what you can see from where you are — even a partial report with a rough location helps responders. Never put yourself between an animal and traffic, and never attempt a rescue in water." },
  { id: "q-edit-after", category: "reporting", title: "Can I change a report after creating it?", body: "You never overwrite history — you add to it. Use Update report for new situations (animal moved, condition changed), and Correct for fixing a field that was entered wrong; the original entry stays visible in the timeline either way. Professionals can also add corrections, and every change is attributed." },
  { id: "q-nolocation", category: "location", title: "What if I don't know the exact spot?", body: "A description is often more useful than coordinates: \u201cnorth side of the pedestrian bridge, under the third lamppost\u201d can beat a GPS point. You can combine any of the three: device location, typed coordinates, or a plain description. Choose approximate or sensitive precision when exactness would risk the animal or someone's privacy." },
  { id: "q-video-length", category: "media", title: "How long should photos or videos be?", body: "Short and steady beats long and shaky: 10\u201330 seconds of the animal and its surroundings usually gives responders everything they need. Very large videos warn you before saving because local storage is finite — media stays on this device unless you explicitly export it." },
  { id: "q-resolved", category: "statuses", title: "When is a report considered resolved?", body: "When the animal reaches an outcome: released (back in the wild), deceased, or the report is closed or cancelled. Everything before that — assigned, pickup, transport, in care — means the case is still moving. The status chip on your report always shows where it currently stands." },
  { id: "q-who-sees", category: "privacy", title: "Who can see my report?", body: "Nobody, until you choose. Records live only on this device. Sharing happens through exports you explicitly create — the shareable version hides your contact details and precise location by default, and the preview shows exactly what will leave the device before you save or print it." },
  { id: "q-move-computer", category: "backups", title: "How do I move my reports to a new computer?", body: "Create a backup (Settings → Storage & backups → Create backup) — a single JSON file containing every incident and photo. On the new device, install the app and use Import backup. Nothing is uploaded anywhere in between; the file travels only as far as you carry it." },
  { id: "q-blank-map", category: "troubleshooting", title: "The map is blank — what do I do?", body: "Maps need an internet connection; everything else works offline. Check Settings → Map → Test connection. If you are online but the map still fails (blocked, rate-limited), the app shows a local position list instead — and the map will recover on its own once the provider is reachable again." },
];

const PROFESSIONAL_ARTICLES: Article[] = [
  { id: "p-getting-started", category: "gettingStarted", title: "Getting started (Professional)", body: "The professional workspace is a Local Professional Preview: powerful operational tooling over local records, clearly labeled, with nothing transmitted. Start at the Operations dashboard." },
  { id: "p-dashboard", category: "dashboard", title: "Operations dashboard", body: "The dashboard gives a situational picture: the Needs Attention queue, live KPIs, the service-area map, a live activity feed, case aging, response performance, the response-flow pipeline and analytics. Filters at the top apply to every widget. Operations View (top right, or Esc to exit) hides all chrome for a dispatch desk or second monitor." },
  { id: "p-network", category: "network", title: "Response network", body: "Currently a Local Professional Preview: the organization registry is fictional and nothing is transmitted. See docs/NETWORK_SECURITY_AND_AUTH_PLAN.md for the connected-mode plan." },
  { id: "p-assignments", category: "assignments", title: "Assignments", body: "Accept a new incident from the dashboard feed or Response network. Accepting records a structured responder-assigned event. Assignment history is visible on the incident's People tab." },
  { id: "p-map", category: "map", title: "Map", body: "The map opens centered on your service area, not the world. Markers respect each incident's location privacy (approximate reports are fuzzed; sensitive never show a precise point). At wider zooms markers cluster. If tiles fail, use Retry or the local position list fallback. Provider status lives in Settings → Map." },
  { id: "p-intake", category: "intake", title: "Professional intake", body: "New incident in professional mode adds optional internal fields — source of report, organization, professional assessment and internal notes — recorded as private notes. They never replace or edit the reporter's original observations." },
  { id: "p-custody", category: "custody", title: "Custody", body: "Every custody change appends to the custody chain. Handoffs close the previous holder's entry and start a new one, so \u201cwho is responsible right now\u201d is always answerable from the record." },
  { id: "p-handoffs", category: "handoffs", title: "Handoffs", body: "Record the transfer, receiving party and condition notes. Handoff analytics show awaiting transfers, transferred-today counts, median waits and receiving organizations." },
  { id: "p-analytics", category: "analytics", title: "Analytics", body: "Metrics prefer structured timeline event metadata; older records fall back to compatibility parsing. Insufficient data shows \u201cNot enough data yet\u201d, never a fake zero. Data-quality notes appear when key fields (like animal group) are missing for most reports." },
  { id: "p-notifications", category: "notifications", title: "Notifications", body: "The bell menu collects local notifications from your records; quiet hours and per-category toggles live in Settings → Notifications. All notifications are generated locally — there is no server push." },
  { id: "p-privacyAccess", category: "privacyAccess", title: "Privacy and access", body: "Professional tools do not bypass privacy: sensitive locations are fuzzed on the map and in exports, shareable exports still honor each report's sharing profile, and private notes are excluded from shareable output." },
  { id: "p-roles", category: "roles", title: "Roles and verification", body: "Roles (field responder, dispatcher, rehabilitator, veterinary professional, ranger, coordinator, administrator, reviewer) tailor the workspace. Until a server verifies you, every role is labeled Professional Preview — local roles never grant authorization, and verification requirements are shown only for the role you are adding." },
  { id: "p-troubleshooting", category: "troubleshooting", title: "Troubleshooting", body: "Check Settings → Map → Test connection for tile issues, review diagnostics in Settings → About, and see Support below for reporting bugs with a privacy-safe bundle." },
  { id: "p-security", category: "security", title: "Security", body: "See docs/SECURITY_ARCHITECTURE.md. Summary: no privileged action is ever based on local workspace state; connected-mode authorization will be enforced server-side; diagnostics never contain incident details, contacts or coordinates." },
  { id: "pq-attention", category: "dashboard", title: "What does \u201cNeeds attention\u201d mean?", body: "It is a work queue, not a score: reports waiting more than 2 hours, incidents without an assigned responder, cases missing a usable location, handoffs waiting for acceptance, and possible duplicates. Every card links to the filtered queue behind it. You can hide the widget — but only after an explicit confirmation, because it is the one panel that should never silently disappear." },
  { id: "q-accept", category: "assignments", title: "How do I accept an incident?", body: "New reports appear in the dashboard feed, the Response network and the queue with an Accept action. Accepting records a structured responder-assigned event with your name and the organization line — it is visible in the incident's People tab. Accept only when someone will actually respond; there is no penalty for leaving it to another responder." },
  { id: "q-marker-shapes", category: "map", title: "What do the marker shapes mean?", body: "Shape and color together, so status is readable without color vision: circles are new/reported, triangles are assigned/responding, diamonds are transfer/in care, squares are closed. At wide zooms markers cluster into count badges — click a cluster to zoom in. Click a marker for a compact inspector with the animal, status, age and an Open incident button." },
  { id: "q-not-enough", category: "analytics", title: "Why do some metrics say \u201cNot enough data yet\u201d?", body: "Medians are only meaningful with a handful of completed cases. Rather than showing a fake zero or a misleading percentage, the dashboard refuses until real data supports the number. The same honesty applies to trend deltas: no comparison is shown when the previous period has no data." },
  { id: "q-handoff-record", category: "handoffs", title: "What is included in a handoff record?", body: "Who handed over, who received, when and where, the animal's condition at transfer, and the itemized contents (carrier, paperwork, medication, and so on). The handoff closes the previous custody entry and starts a new one, so \u201cwho is responsible right now\u201d is always answerable from the record." },
  { id: "q-notifications-missing", category: "notifications", title: "Why am I not getting notifications?", body: "Notifications are generated locally from your own records — there is no server push. Check the category toggles and quiet hours in Settings → Notifications; during quiet hours events are still recorded in the bell menu but no toast appears. In the desktop app the bell lives in the sidebar footer; on mobile it is in the top bar." },
  { id: "q-multi-role", category: "roles", title: "Can I hold multiple professional roles?", body: "Yes — add each role from Settings → Profile. Each role carries its own verification requirements and preview state, and you choose one active role to tailor the dashboard, navigation and Help. Holding or switching roles never changes what you are allowed to do: until a server verifies you, everything is labeled Professional Preview." },
  { id: "q-intake-visibility", category: "intake", title: "Who sees professional intake notes?", body: "Internal fields (source, organization, assessment, internal note) are stored as private notes. They stay in your local workspace and are excluded from shareable exports by default — the export preview marks them as excluded. The reporter's original observations are never edited by intake fields; both histories remain intact." },
];

const CATEGORY_ORDER_REPORTER = ["gettingStarted", "reporting", "safety", "location", "media", "statuses", "privacy", "backups", "troubleshooting"];
const CATEGORY_ORDER_PRO = ["gettingStarted", "dashboard", "network", "assignments", "map", "intake", "custody", "handoffs", "analytics", "notifications", "privacyAccess", "roles", "security", "troubleshooting"];

export function HelpPage() {
  const { settings } = useApp();
  const { t } = useTranslation(["help", "glossary"]);
  const navigate = useNavigate();
  const isPro = settings.workspace === "professional";
  const [role, setRole] = useState<Workspace>(settings.workspace);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [view, setView] = useState<"topics" | "glossary" | "support">("topics");
  const [helpful, setHelpful] = useState<Record<string, boolean>>({});

  const allArticles = role === "professional" ? PROFESSIONAL_ARTICLES : REPORTER_ARTICLES;
  const categoryOrder = role === "professional" ? CATEGORY_ORDER_PRO : CATEGORY_ORDER_REPORTER;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allArticles.filter((a) =>
      (category === "all" || a.category === category) &&
      (!q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)));
  }, [query, category, allArticles]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of filtered) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return categoryOrder.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [filtered, categoryOrder]);

  // P13: reporters cannot switch into Professional Help.
  const canSwitch = isPro;

  const openTopic = (a: Article) => { setOpenArticle(a); setView("topics"); };

  const related = openArticle
    ? allArticles.filter((a) => a.category === openArticle.category && a.id !== openArticle.id)
    : [];

  return (
    <main className="content wide" id="main-content">
      <div className="row between" style={{ flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: "var(--space-4)" }}>
        <h1 style={{ margin: 0 }}>{t("help:title", { defaultValue: "Help center" })}</h1>
        {canSwitch && (
          <div className="segmented" role="tablist" aria-label={t("help:role", { defaultValue: "Help for" })}>
            <button role="tab" aria-selected={role === "reporter"} aria-pressed={role === "reporter"} onClick={() => { setRole("reporter"); setOpenArticle(null); setCategory("all"); }}>
              {t("help:reporter", { defaultValue: "Reporter help" })}
            </button>
            <button role="tab" aria-selected={role === "professional"} aria-pressed={role === "professional"} onClick={() => { setRole("professional"); setOpenArticle(null); setCategory("all"); }}>
              {t("help:professional", { defaultValue: "Professional help" })}
            </button>
          </div>
        )}
      </div>

      <div className="help-shell">
        {/* ---- Left rail: search + persistent navigation ---- */}
        <aside className="help-rail" aria-label={t("help:categories", { defaultValue: "Categories" })}>
          <input
            className="input"
            type="search"
            placeholder={t("help:searchPlaceholder", { defaultValue: "Search help articles…" })}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setView("topics"); setCategory("all"); }}
            aria-label={t("help:searchPlaceholder", { defaultValue: "Search help articles…" })}
          />
          <nav style={{ display: "grid", gap: 2 }} aria-label={t("help:categories", { defaultValue: "Categories" })}>
            <button className={"help-rail-item" + (view === "topics" && category === "all" && !openArticle ? " active" : "")} onClick={() => { setView("topics"); setCategory("all"); setOpenArticle(null); }}>
              {t("help:catAll", { defaultValue: "All topics" })}
            </button>
            {categoryOrder.map((c) => (
              <button key={c} className={"help-rail-item" + (view === "topics" && category === c ? " active" : "")} onClick={() => { setView("topics"); setCategory(c); setOpenArticle(null); }}>
                {t(`help:cat_${c}`, { defaultValue: c })}
              </button>
            ))}
          </nav>
          <div className="help-rail-group">
            <span className="help-rail-heading">{t("help:tutorialsTitle", { defaultValue: "Tutorials" })}</span>
            <button className="help-rail-item" onClick={() => void startGuidedTour("interface")}>
              <Icons.compass size={14} /> {t("help:startTour", { defaultValue: "Start tour" })}
            </button>
            <button className="help-rail-item" onClick={() => void startGuidedTour("first-report")}>
              <Icons.compass size={14} /> {t("help:openTutorial", { defaultValue: "Guided first report" })}
            </button>
            <button className="help-rail-item" onClick={() => navigate("/examples")}>
              <Icons.eye size={14} /> {t("help:openExamples", { defaultValue: "Fictional demo" })}
            </button>
          </div>
          <div className="help-rail-group">
            <span className="help-rail-heading">{t("help:reference", { defaultValue: "Reference" })}</span>
            <button className={"help-rail-item" + (view === "glossary" ? " active" : "")} onClick={() => { setView("glossary"); setOpenArticle(null); }}>
              {t("glossaryTitle", { ns: "help", defaultValue: "Glossary" })}
            </button>
            <button className={"help-rail-item" + (view === "support" ? " active" : "")} onClick={() => { setView("support"); setOpenArticle(null); }}>
              {t("help:supportTitle", { defaultValue: "Support" })}
            </button>
          </div>
        </aside>

        {/* ---- Reading pane ---- */}
        <section className="help-reader" aria-live="polite">
          {view === "glossary" ? (
            <article className="card help-article">
              <h2 style={{ marginTop: 0 }}>{t("glossaryTitle", { ns: "help", defaultValue: "Glossary" })}</h2>
              <dl className="kv">
                {GLOSSARY_TERMS.map((term) => (
                  <div key={term} style={{ marginBottom: 10 }}>
                    <dt style={{ fontWeight: 650 }}>{t(`glossary:${term}_term`, { defaultValue: term })}</dt>
                    <dd style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{t(`glossary:${term}`, { defaultValue: "" })}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ) : view === "support" ? (
            <SupportComposer />
          ) : openArticle ? (
            <article className="card help-article">
              <div className="row between" style={{ alignItems: "center" }}>
                <button className="btn btn-quiet btn-sm" onClick={() => setOpenArticle(null)}>
                  <Icons.chevronLeft size={14} /> {t("help:backToTopics", { defaultValue: "All topics" })}
                </button>
                <span className="badge">{t(`help:cat_${openArticle.category}`, { defaultValue: openArticle.category })}</span>
              </div>
              <h2 style={{ marginBottom: "var(--space-3)" }}>{openArticle.title}</h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.65, color: "var(--c-ink)" }}>{openArticle.body}</p>
              {openArticle.tour && (
                <button className="btn btn-secondary btn-sm" onClick={() => void startGuidedTour(openArticle.tour!)}>
                  <Icons.compass size={14} /> {t("help:showMe", { defaultValue: "Show me" })}
                </button>
              )}
              <div className="row" style={{ gap: 8, marginTop: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
                <span className="hint" style={{ margin: 0 }}>{t("help:wasHelpful", { defaultValue: "Was this helpful?" })}</span>
                <button
                  className={"btn btn-sm " + (helpful[openArticle.id] === true ? "btn-primary" : "btn-quiet")}
                  aria-pressed={helpful[openArticle.id] === true}
                  onClick={() => setHelpful((h) => ({ ...h, [openArticle.id]: true }))}
                >
                  {t("help:helpfulYes", { defaultValue: "Yes" })}
                </button>
                <button
                  className={"btn btn-sm " + (helpful[openArticle.id] === false ? "btn-primary" : "btn-quiet")}
                  aria-pressed={helpful[openArticle.id] === false}
                  onClick={() => setHelpful((h) => ({ ...h, [openArticle.id]: false }))}
                >
                  {t("help:helpfulNo", { defaultValue: "No" })}
                </button>
                {helpful[openArticle.id] != null && (
                  <span className="hint" style={{ margin: 0 }}>{t("help:feedbackThanks", { defaultValue: "Thanks — your feedback is stored on this device only." })}</span>
                )}
              </div>
              {related.length > 0 && (
                <div style={{ marginTop: "var(--space-5)" }}>
                  <h3 className="section-label">{t("help:related", { defaultValue: "Related articles" })}</h3>
                  <ul className="help-related" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {related.map((a) => (
                      <li key={a.id}>
                        <button className="help-rail-item" style={{ width: "100%" }} onClick={() => setOpenArticle(a)}>
                          <Icons.list size={14} /> {a.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ) : (
            <div className="help-topic-list">
              {grouped.length === 0 && <p className="hint">{t("help:noResults", { defaultValue: "No matching topics. Try another search or check the glossary." })}</p>}
              {grouped.map(([cat, articles]) => (
                <section key={cat} aria-label={t(`help:cat_${cat}`, { defaultValue: cat })}>
                  {category === "all" && <h2 className="section-label">{t(`help:cat_${cat}`, { defaultValue: cat })}</h2>}
                  <div className="help-topic-list-inner">
                    {articles.map((a) => (
                      <button key={a.id} className="help-topic-row" onClick={() => openTopic(a)}>
                        <span className="help-topic-copy">
                          <strong>{a.title}</strong>
                          <span>{a.body.length > 110 ? a.body.slice(0, 107).trimEnd() + "…" : a.body}</span>
                        </span>
                        <Icons.chevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const SUPPORT_CATEGORIES = ["bug", "question", "feature", "data", "professional_access", "map_location", "other"] as const;

function SupportComposer() {
  const { settings } = useApp();
  const { t } = useTranslation("help");
  const [category, setCategory] = useState<string>("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [prepared, setPrepared] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function buildDiagnostics(): Promise<string> {
    if (!includeDiagnostics) return "";
    const [incidents, blobs, est] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs(), estimateStorage()]);
    return [
      "", "--- diagnostics (privacy-safe) ---",
      `applicationVersion: ${APP_VERSION}`,
      `buildId: ${BUILD_ID}`,
      `dataSchemaVersion: ${DATA_SCHEMA_VERSION}`,
      `license: ${APP_LICENSE}`,
      `platform: ${isTauri() ? "desktop (Tauri)" : "web/PWA"}`,
      `workspace: ${settings.workspace}`,
      `language: ${settings.language}`,
      `theme: ${settings.theme} / motion: ${settings.motion}`,
      `incidents: ${incidents.length}`,
      `attachments: ${blobs.length}`,
      `storageUsage: ${est ? bytesToSize(est.usage) : "not reported"}`,
      `online: ${navigator.onLine}`,
      "Privacy note: this bundle intentionally contains NO incident details, contact info, coordinates or media.",
    ].join(String.fromCharCode(10));
  }

  async function prepare() {
    const diag = await buildDiagnostics();
    const text = [
      `Subject: [${category}] ${subject || "(no subject)"}`,
      email ? `Reply-to: ${email}` : "Reply-to: (not provided)",
      "",
      description || "(no description)",
      diag,
    ].join(String.fromCharCode(10));
    setPrepared(text);
  }

  function download() {
    if (!prepared) return;
    const blob = new Blob([prepared], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wih-support-request-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ maxWidth: 720, marginTop: "var(--space-3)" }}>
      <h3 style={{ marginTop: 0 }}>{t("whatNeeded", { defaultValue: "What do you need help with?" })}</h3>
      <Select
        label={t("category", { defaultValue: "Category" })}
        value={category}
        onChange={setCategory}
        options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: t(`support:cat_${c}`, { defaultValue: c }) }))}
      />
      <TextField label={t("subject", { defaultValue: "Subject" })} value={subject} onChange={setSubject} />
      <TextField label={t("description", { defaultValue: "Description" })} value={description} onChange={setDescription} multiline rows={4} />
      <TextField label={t("email", { defaultValue: "Contact email (optional)" })} type="email" value={email} onChange={setEmail} optional />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem", cursor: "pointer", margin: "var(--space-2) 0" }}>
        <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
        {t("includeDiag", { defaultValue: "Include privacy-safe diagnostics (never incident details, contacts or coordinates)" })}
      </label>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" onClick={() => void prepare()}>{t("prepare", { defaultValue: "Prepare support request" })}</button>
        <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff/issues" target="_blank" rel="noreferrer">{t("ghIssue", { defaultValue: "Open GitHub issue" })}</a>
        <a className="btn btn-ghost btn-sm" href="https://github.com/amgedi/wildlife-incident-handoff/discussions" target="_blank" rel="noreferrer">{t("ghDiscussions", { defaultValue: "GitHub discussions" })}</a>
      </div>
      {prepared && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <p className="hint" style={{ marginTop: 0 }}>{t("honesty", { defaultValue: "There is no support server yet — nothing was sent. Copy or download the request below and paste it into a GitHub issue or discussion." })}</p>
          <pre className="card" style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem", maxHeight: 220, overflowY: "auto", userSelect: "all" }}>{prepared}</pre>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(prepared); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
              {copied ? t("copied", { defaultValue: "Copied!" }) : t("copy", { defaultValue: "Copy support request" })}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={download}>
              <Icons.download size={14} /> {t("download", { defaultValue: "Download support bundle" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
