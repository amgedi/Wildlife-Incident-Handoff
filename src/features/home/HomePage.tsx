/** Calm, useful home screen: hero, continue working, recent incidents. */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { BrandMark } from "../../components/BrandMark";
import { EmptyState } from "../../components/ui";
import { useIncidents, IncidentCard } from "../incidents/IncidentCard";
import { getAllDrafts } from "../../storage/repositories";
import { useEffect, useState } from "react";
import type { DraftRecord } from "../../storage/db";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";

export function HomePage({ onStartTour }: { onStartTour: () => void }) {
  const { incidents } = useIncidents();
  const { settings } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftRecord | null>(null);

  useEffect(() => {
    getAllDrafts().then((drafts) => {
      const d = drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
      if (d) setDraft(d);
    });
  }, []);

  const { active, recent } = useMemo(() => {
    if (!incidents) return { active: [], recent: [] };
    const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt);
    const activeList = live
      .filter((i) => !["closed", "cancelled", "released", "deceased"].includes(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      active: activeList.slice(0, 3),
      recent: live
        .filter((i) => !activeList.slice(0, 3).some((a) => a.id === i.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    };
  }, [incidents]);

  const first = active[0];

  return (
    <main className="content" id="main-content">
      <section className="hero fade-in" data-tour-id="hero">
        <BrandMark size={44} />
        <h1 style={{ marginTop: "var(--space-4)" }}>Wildlife Incident Handoff</h1>
        <p style={{ fontSize: "1.05rem" }}>
          {settings.displayName ? `Welcome back, ${settings.displayName}. ` : ""}Clear information. Safer handoffs.
          Record what you observed, keep the whole story in order, and pass the case on without losing context.
        </p>
        <div className="hero-actions">
          <Link to="/incidents/new" className="btn btn-primary btn-lg" data-tour-id="hero-create">
            <Icons.plus size={18} />
            Create incident
          </Link>
          <Link to="/incidents" className="btn btn-secondary btn-lg" data-tour-id="hero-open" style={{ background: "rgb(255 255 255 / 0.12)", color: "inherit", borderColor: "rgb(255 255 255 / 0.3)" }}>
            <Icons.list size={18} />
            Open incidents
          </Link>
          {!settings.tourCompleted && (
            <button className="btn btn-ghost btn-lg" style={{ color: "rgb(255 255 255 / 0.85)" }} onClick={onStartTour}>
              <Icons.compass size={18} />
              Take the tour
            </button>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <Icons.paw size={260} />
        </div>
      </section>

      {draft && (
        <div className="notice warning" style={{ marginTop: "var(--space-5)" }} data-tour-id="draft-recovery">
          <Icons.edit size={20} />
          <div style={{ flex: 1 }}>
            <strong>Unfinished draft</strong> — an incident was being created ({relativeTime(draft.savedAt)}).
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate("/incidents/new?resume=1")}>
                Resume draft
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setDraft(null)}>
                Discard reminder
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "var(--space-5)", display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
        <Icons.help size={22} style={{ color: "var(--c-primary)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: 0 }}>Not sure what to do?</h3>
          <p style={{ margin: "4px 0 0", color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
            Guide me walks you through a real report, one friendly step at a time.
          </p>
        </div>
        <Link to="/incidents/new?guide=1" className="btn btn-primary">
          <Icons.compass size={16} />
          Guide me
        </Link>
      </div>

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>Continue working</h2>
      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Icons.paw size={44} />}
            title="No incidents yet"
            hint="Create your first incident to start recording observations and handoffs."
            action={
              <Link to="/incidents/new" className="btn btn-primary">
                <Icons.plus size={16} />
                Create incident
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
            {animalLabel(first)} — {first.nextStep ? `Next step: ${first.nextStep}` : "No next step recorded yet."}
          </p>
          <Link className="btn btn-secondary btn-sm" to={`/incidents/${first.id}`}>Continue</Link>
        </div>
      )}

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>Recent incidents</h2>
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
