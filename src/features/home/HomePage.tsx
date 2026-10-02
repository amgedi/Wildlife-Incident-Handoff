/** Calm, useful home screen: hero, continue working, recent incidents. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { BrandMark, BearPawMark } from "../../components/BrandMark";
import { EmptyState } from "../../components/ui";
import { useIncidents, IncidentCard } from "../incidents/IncidentCard";
import { getAllDrafts } from "../../storage/repositories";
import { useEffect, useState } from "react";
import type { DraftRecord } from "../../storage/db";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";

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

  const { active, recent, inProgress, awaiting, resolved } = useMemo(() => {
    if (!incidents) return { active: [], recent: [], inProgress: [], awaiting: [], resolved: [] };
    const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo);
    const activeList = live
      .filter((i) => !["closed", "cancelled", "released", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const awaitingList = live.filter((i) => ["reported", "response_requested"].includes(i.status));
    const resolvedList = live
      .filter((i) => ["released", "closed", "cancelled", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3);
    return {
      active: activeList.slice(0, 3),
      recent: live
        .filter((i) => !activeList.slice(0, 3).some((a) => a.id === i.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
      inProgress: activeList.filter((i) => !["reported", "response_requested"].includes(i.status)),
      awaiting: awaitingList,
      resolved: resolvedList,
    };
  }, [incidents]);

  const first = active[0];

  return (
    <main className="content" id="main-content">
      <section className="hero fade-in" data-tour-id="hero">
        <BrandMark size={44} />
        {isReporter ? (
          <>
            <h1 style={{ marginTop: "var(--space-4)" }}>{t("home:foundWildlife")}</h1>
            <p style={{ fontSize: "1.05rem" }}>{t("home:heroReporter")}</p>
          </>
        ) : (
          <>
            <h1 style={{ marginTop: "var(--space-4)" }}>{t("appName")}</h1>
            <p style={{ fontSize: "1.05rem" }}>
              {settings.displayName ? t("home:welcomeBack", { name: settings.displayName }) : ""}{t("home:heroProfessional")}
            </p>
          </>
        )}
        <div className="hero-actions">
          <Link to="/incidents/new" className="btn btn-primary btn-lg" data-tour-id="hero-create">
            <Icons.plus size={18} />
            {isReporter ? t("navigation:reportWildlife") : t("navigation:createIncident")}
          </Link>
          <Link to="/incidents" className="btn btn-secondary btn-lg btn-hero-secondary" data-tour-id="hero-open">
            <Icons.list size={18} />
            {isReporter ? t("home:openIncidents") : t("home:openIncidentsPro")}
          </Link>
          {!settings.tourCompleted && (
            <button className="btn btn-ghost btn-lg btn-hero-ghost" onClick={() => {
              void import("../tutorial/guidance").then(async ({ buildInterfaceTourSteps }) => {
                const steps = await buildInterfaceTourSteps(settings.workspace);
                startGuidance("interface-tour", steps);
              });
            }}>
              <Icons.compass size={18} />
              Take the tour
            </button>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <BearPawMark size={250} tile={false} style={{ color: "var(--hero-paw)", opacity: 0.1, transform: "rotate(-8deg)" }} />
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

      <div className="card" style={{ marginTop: "var(--space-5)", display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }} data-tour-id="guide-me-card">
        <Icons.help size={22} style={{ color: "var(--c-primary)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: 0 }}>{t("home:notSureWhatToDo")}</h3>
          <p style={{ margin: "4px 0 0", color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>{t("home:guideMeBlurb")}</p>
        </div>
        <Link to="/incidents/new?guide=1" className="btn btn-primary">
          <Icons.compass size={16} />
          {t("home:guideMe")}
        </Link>
      </div>

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>
        {isReporter ? t("home:yourReports") : t("home:continueWorking")}
      </h2>
      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BearPawMark size={48} tile={false} style={{ color: "var(--brand-icon-bg)" }} />}
            title="No incidents yet"
            hint={isReporter ? t("home:noReportsHint") : t("home:noIncidentsHint")}
            action={
              <Link to="/incidents/new" className="btn btn-primary">
                <Icons.plus size={16} />
                {isReporter ? t("navigation:reportWildlife") : t("navigation:createIncident")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card-list" data-tour-id="continue-working">
          {active.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </div>
      )}

      {first && (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <h3>Latest active incident</h3>
          <p style={{ color: "var(--c-ink-soft)" }}>
            {animalLabel(first)} — {first.nextStep ? t("workspace:nextStep") + ": " + first.nextStep : t("home:noNextStep")}
          </p>
          <Link className="btn btn-secondary btn-sm" to={`/incidents/${first.id}`}>Continue</Link>
        </div>
      )}

      {isReporter && (inProgress.length > 0 || awaiting.length > 0 || resolved.length > 0) && (
        <div className="grid-2" style={{ marginTop: "var(--space-4)" }}>
          <div className="card" style={{ padding: "var(--space-4)" }}>
            <h3>{t("home:inProgress", { count: inProgress.length })}</h3>
            <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>{t("home:inProgressHint")}</p>
          </div>
          <div className="card" style={{ padding: "var(--space-4)" }}>
            <h3>{t("home:awaitingResponse", { count: awaiting.length })}</h3>
            <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>{t("home:awaitingHint")}</p>
          </div>
          <div className="card" style={{ padding: "var(--space-4)", gridColumn: "1 / -1" }}>
            <h3>{t("home:resolved", { count: resolved.length })}</h3>
            {resolved.length === 0 ? (
              <p style={{ margin: 0, color: "var(--c-ink-faint)", fontSize: "0.88rem" }}>{t("home:resolvedHint")}</p>
            ) : (
              <div className="card-list" style={{ marginTop: 8 }}>
                {resolved.map((i) => <IncidentCard key={i.id} incident={i} />)}
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>{t("home:recentIncidents")}</h2>
      {recent.length === 0 && active.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--c-ink-faint)" }}>
            Recently updated incidents will appear here. Closed cases are kept out of the way but stay searchable.
          </p>
        </div>
      ) : (
        <div className="card-list">
          {recent.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </div>
      )}

    </main>
  );
}
