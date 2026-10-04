/**
 * Home (0.2.0-dev.7). Reporter Home rebuilt with a real hierarchy:
 * greeting → safety BEFORE action → report CTA → latest active report →
 * your reports summary → drafts → recent reports → help.
 * The professional workspace's operational home is the dashboard (/network).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { AppMark } from "../../components/BrandMark";
import { LeaderboardCard } from "../social/LeaderboardCard";

import { EmptyState } from "../../components/ui";
import { StatusBadge } from "../../components/ui";
import { useIncidents, IncidentCard } from "../incidents/IncidentCard";
import { getAllDrafts } from "../../storage/repositories";
import { useEffect, useState } from "react";
import type { DraftRecord } from "../../storage/db";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";
import { getAuthorizationState } from "../network/authorization";

export function HomePage() {
  const { incidents } = useIncidents();
  const { settings, startGuidance } = useApp();
  const { t } = useTranslation();
  const isReporter = settings.workspace === "reporter";
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftRecord | null>(null);

  useEffect(() => {
    getAllDrafts().then((drafts) => {
      const d = drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
      if (d) setDraft(d);
    });
  }, []);

  const { latestActive, awaiting, inProgress, resolvedCount, recent } = useMemo(() => {
    if (!incidents) return { latestActive: null, awaiting: [], inProgress: [], resolvedCount: 0, recent: [] };
    const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo);
    const activeList = live
      .filter((i) => !["closed", "cancelled", "released", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const resolvedList = live
      .filter((i) => ["released", "closed", "cancelled", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      latestActive: activeList[0] ?? null,
      awaiting: live.filter((i) => ["reported", "response_requested"].includes(i.status)),
      inProgress: activeList.filter((i) => !["reported", "response_requested"].includes(i.status)),
      resolvedCount: resolvedList.length,
      recent: activeList.slice(1, 7),
    };
  }, [incidents]);

  const firstName = (settings.displayName || settings.savedReporterContact?.name || "").trim().split(/\s+/)[0];
  const latestUpdate = latestActive ? [...latestActive.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;
  const nextAction = latestActive?.nextStep
    ? latestActive.nextStep
    : latestActive
      ? t("home:noNewAction", { defaultValue: "No new action — updates will appear here." })
      : null;

  // ---------- Reporter home ----------
  if (isReporter) {
    return (
      <main className="content" id="main-content">
        <h1 className="fade-in" data-tour-id="hero" style={{ marginBottom: "var(--space-2)" }}>
          {firstName
            ? t("home:welcomeShort", { name: firstName, defaultValue: "Welcome, {{name}}", interpolation: { escapeValue: false } })
            : t("home:welcome", { defaultValue: "Welcome" })}
        </h1>
        <p style={{ color: "var(--c-ink-soft)", marginTop: 0 }}>
          {t("home:homeSubtitle", { defaultValue: "Help with the animal in front of you — calmly and safely." })}
        </p>

        {/* Safety BEFORE action */}
        <section
          className="card safety-first fade-in"
          aria-labelledby="safety-first-title"
          style={{ borderColor: "var(--c-warn)", marginTop: "var(--space-4)" }}
          data-tour-id="safety-card"
        >
          <h2 id="safety-first-title" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8, fontSize: "1.05rem" }}>
            <Icons.warning size={18} style={{ color: "var(--c-warn)" }} />
            {t("home:beforeYouApproach", { defaultValue: "Before you approach wildlife" })}
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--c-ink-soft)", fontSize: "0.95rem" }}>
            <li>{t("home:safetyDistance", { defaultValue: "Observe from a safe distance" })}</li>
            <li>{t("home:safetyPeople", { defaultValue: "Keep people and pets away" })}</li>
            <li>{t("home:safetyHandling", { defaultValue: "Avoid unnecessary handling" })}</li>
            <li>{t("home:safetyProfessional", { defaultValue: "Contact appropriate local professionals when needed" })}</li>
          </ul>
        </section>

        <div style={{ marginTop: "var(--space-4)" }} className="fade-in">
          <Link to="/incidents/new" className="btn btn-primary btn-lg" data-tour-id="hero-create">
            <Icons.plus size={18} />
            {t("navigation:reportWildlife", { defaultValue: "Report wildlife" })}
          </Link>
        </div>

        {latestActive && (
          <section aria-labelledby="latest-report-title" style={{ marginTop: "var(--space-6)" }}>
            <h2 id="latest-report-title" className="section-label">{t("home:latestActiveReport", { defaultValue: "Latest active report" })}</h2>
            <div className="card" data-tour-id="latest-report">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.05rem" }}>{animalLabel(latestActive)}</strong>
                <StatusBadge status={latestActive.status} />
                <span style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>
                  {t("home:latestUpdate", { defaultValue: "Latest update" })}: {latestUpdate ? relativeTime(latestUpdate.timestamp) : relativeTime(latestActive.updatedAt)}
                </span>
              </div>
              {nextAction && (
                <p style={{ color: "var(--c-ink-soft)", margin: "var(--space-2) 0 0" }}>
                  <Icons.flag size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {nextAction}
                </p>
              )}
              <div style={{ marginTop: "var(--space-3)" }}>
                <Link className="btn btn-secondary btn-sm" to={`/incidents/${latestActive.id}`}>{t("home:continue", { defaultValue: "Continue" })}</Link>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="your-reports-title" style={{ marginTop: "var(--space-6)" }}>
          <h2 id="your-reports-title" className="section-label">{t("home:yourReports", { defaultValue: "Your reports" })}</h2>
          <div className="summary-cards">
            <button
              className={`summary-card${awaiting.length === 0 ? " zero" : ""}`}
              onClick={() => navigate("/incidents?category=awaiting")}
              aria-label={t("home:awaitingResponse", { count: awaiting.length })}
            >
              <span className="summary-count">{awaiting.length}</span>
              <span className="summary-label">{t("home:awaitingResponseShort", { defaultValue: "Awaiting response" })}</span>
            </button>
            <button
              className={`summary-card${inProgress.length === 0 ? " zero" : ""}`}
              onClick={() => navigate("/incidents?category=active")}
              aria-label={t("home:inProgress", { count: inProgress.length })}
            >
              <span className="summary-count">{inProgress.length}</span>
              <span className="summary-label">{t("home:inProgressShort", { defaultValue: "In progress" })}</span>
            </button>
            <button
              className={`summary-card${resolvedCount === 0 ? " zero" : ""}`}
              onClick={() => navigate("/incidents?category=resolved")}
              aria-label={t("home:resolved", { count: resolvedCount })}
            >
              <span className="summary-count">{resolvedCount}</span>
              <span className="summary-label">{t("home:resolvedShort", { defaultValue: "Resolved" })}</span>
            </button>
          </div>
        </section>

        <div className="card" style={{ marginTop: "var(--space-5)", display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }} data-tour-id="guide-me-card">
          <Icons.help size={22} style={{ color: "var(--c-primary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: 0 }}>{t("home:notSureWhatToDo", { defaultValue: "Not sure what to do?" })}</h3>
            <p style={{ margin: "4px 0 0", color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{t("home:guideMeBlurb", { defaultValue: "Answer a few questions and the app guides you through a safe report." })}</p>
          </div>
          <Link to="/incidents/new?guide=1" className="btn btn-primary">
            <Icons.compass size={16} />
            {t("home:guideMe", { defaultValue: "Guide me" })}
          </Link>
        </div>

        <div style={{ marginTop: "var(--space-5)" }} data-tour-id="leaderboard-card">
          <LeaderboardCard />
        </div>

        {draft && (
          <div className="notice warning" style={{ marginTop: "var(--space-5)" }} data-tour-id="draft-recovery">
            <Icons.edit size={20} />
            <div style={{ flex: 1 }}>
              <strong>{t("home:draftFound")}</strong> {t("home:draftFoundAt", { when: relativeTime(draft.savedAt) })}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate("/incidents/new?resume=1")}>
                  {t("home:resumeDraft")}
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => setDraft(null)}>
                  {t("home:discardReminder")}
                </button>
              </div>
            </div>
          </div>
        )}

        <section aria-labelledby="recent-reports-title" style={{ marginTop: "var(--space-6)" }}>
          <h2 id="recent-reports-title" className="section-label">{t("home:recentIncidents", { defaultValue: "Recent reports" })}</h2>
          {recent.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: "var(--c-ink-faint)" }}>
                {t("home:recentEmpty", { defaultValue: "Your reports will appear here." })}
              </p>
            </div>
          ) : (
            <div className="card-list">
              {recent.map((i) => (
                <IncidentCard key={i.id} incident={i} />
              ))}
            </div>
          )}
        </section>

        <div className="row" style={{ marginTop: "var(--space-6)", gap: 10, flexWrap: "wrap" }}>
          <Link to="/help" className="btn btn-ghost btn-sm"><Icons.help size={15} /> {t("home:helpSupport", { defaultValue: "Help & support" })}</Link>
          <Link to="/settings" className="btn btn-ghost btn-sm"><Icons.settings size={15} /> {t("navigation:settings", { defaultValue: "Settings" })}</Link>
        </div>
      </main>
    );
  }

  // ---------- Professional home (redirect-style gateway to the dashboard) ----------
  const firstNamePro = (settings.professionalProfile?.name || settings.displayName || "").trim().split(/\s+/)[0];
  const isVerified = getAuthorizationState().status === "verified";
  return (
    <main className="content" id="main-content">
      <section className="hero fade-in" data-tour-id="hero">
        <h1 style={{ marginTop: "var(--space-4)" }}>
          {firstNamePro
            ? t("home:welcomeShort", { name: firstName, defaultValue: "Welcome, {{name}}", interpolation: { escapeValue: false } })
            : t("home:welcome", { defaultValue: "Welcome" })}
        </h1>
        {settings.professionalProfile?.organization && (
          <p style={{ color: "var(--c-ink-faint)", margin: 0 }}>{settings.professionalProfile.organization}</p>
        )}
        <span className="badge" data-status="response_requested" style={{ marginTop: 8 }}>
          {isVerified
            ? t("home:verifiedWorkspace", { defaultValue: "Verified" })
            : t("home:professionalPreview", { defaultValue: "Professional Preview" })}
        </span>
        <p style={{ fontSize: "1.05rem", marginTop: "var(--space-3)" }}>{t("home:heroProfessional")}</p>
        <div className="hero-actions">
          <Link to="/network" className="btn btn-primary btn-lg" data-tour-id="hero-dashboard">
            <Icons.activity size={18} />
            {t("home:openDashboard", { defaultValue: "Open operations dashboard" })}
          </Link>
          <Link to="/incidents/new" className="btn btn-secondary btn-lg" data-tour-id="hero-create">
            <Icons.plus size={18} />
            {t("navigation:createIncident")}
          </Link>
          <Link to="/incidents" className="btn btn-ghost btn-lg btn-hero-ghost">
            <Icons.list size={18} />
            {t("home:openIncidentsPro")}
          </Link>
          {!settings.tourCompleted && (
            <button className="btn btn-ghost btn-lg btn-hero-ghost" onClick={() => {
              void import("../tutorial/guidance").then(async ({ buildInterfaceTourSteps }) => {
                const steps = await buildInterfaceTourSteps(settings.workspace);
                startGuidance("interface-tour", steps);
              });
            }}>
              <Icons.compass size={18} />
              {t("navigation:takeTheTour")}
            </button>
          )}
        </div>
      </section>

      {draft && (
        <div className="notice warning" style={{ marginTop: "var(--space-5)" }} data-tour-id="draft-recovery">
          <Icons.edit size={20} />
          <div style={{ flex: 1 }}>
            <strong>{t("home:draftFound")}</strong> {t("home:draftFoundAt", { when: relativeTime(draft.savedAt) })}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate("/incidents/new?resume=1")}>
                {t("home:resumeDraft")}
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setDraft(null)}>
                {t("home:discardReminder")}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>{t("home:continueWorking")}</h2>
      <EmptyWorkingList />
    </main>
  );

  function EmptyWorkingList() {
    const activeList = (incidents ?? [])
      .filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo && !["closed", "cancelled", "released", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);
    if (activeList.length === 0) {
      return (
        <div className="card">
          <EmptyState
            icon={<AppMark size={48} tile={false} style={{ color: "var(--brand-icon-bg)" }} />}
            title={t("home:noIncidentsTitle", { defaultValue: "No incidents yet" })}
            hint={t("home:noIncidentsHint", { defaultValue: "Create the first incident to get started." })}
            action={
              <Link to="/incidents/new" className="btn btn-primary">
                <Icons.plus size={16} />
                {t("navigation:createIncident")}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div className="card-list" data-tour-id="continue-working">
        {activeList.map((i) => (
          <IncidentCard key={i.id} incident={i} />
        ))}
      </div>
    );
  }
}
