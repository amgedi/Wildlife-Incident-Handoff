/** Examples & Tutorial hub: fictional demo cases and the guided first incident. */
import { useNavigate } from "react-router-dom";
import { Icons } from "../../components/Icons";
import { buildDemoIncidents } from "./demoData";
import { animalLabel } from "../export/exportService";
import { StatusBadge } from "../../components/ui";
import { relativeTime } from "../../utils/time";
import { useIncidents } from "../incidents/IncidentCard";
import { putIncident } from "../../storage/repositories";
import { useApp } from "../../app/AppContext";
import { buildInterfaceTourSteps, buildDemoTourSteps } from "./guidance";
import { formatHumanReference, nextSequenceFromRefs, uuid } from "../../utils/id";
import { nowIso } from "../../utils/time";
import type { Incident } from "../../types/incident";

export function ExamplesPage() {
  const navigate = useNavigate();
  const { showToast, settings, startGuidance } = useApp();
  const { incidents, refresh } = useIncidents();
  const demos = buildDemoIncidents();

  async function copyDemo(demo: Incident) {
    const real = await getAllRealRefs();
    const copied: Incident = {
      ...structuredClone(demo),
      id: uuid(),
      isDemo: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      humanReference: formatHumanReference(new Date().getFullYear(), nextSequenceFromRefs(real)),
      timeline: demo.timeline.map((e) => ({ ...e, eventId: uuid().slice(0, 8), incidentId: "" })),
      attachments: [],
      notes: demo.notes.map((n) => ({ ...n, id: uuid().slice(0, 8) })),
    };
    copied.timeline.forEach((e) => (e.incidentId = copied.id));
    await putIncident(copied);
    await refresh();
    showToast("Copied into your workspace");
    navigate(`/incidents/${copied.id}`);
  }

  async function getAllRealRefs(): Promise<string[]> {
    const { getAllIncidents } = await import("../../storage/repositories");
    return (await getAllIncidents()).filter((i) => !i.isDemo).map((i) => i.humanReference);
  }

  const hasCopied = (incidents ?? []).some((i) => !i.isDemo);

  return (
    <main className="content" id="main-content">
      <h1>Examples & tutorial</h1>
      <p style={{ color: "var(--c-ink-soft)", maxWidth: "62ch" }}>
        Fictional demo cases teach the workflow without touching your real incidents. Demo data is always labeled and never
        appears in your incident lists unless you explicitly copy it.
      </p>

      <div className="card" style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
        <Icons.compass size={28} style={{ color: "var(--c-primary)" }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: 0 }}>Guided first incident</h3>
          <p style={{ margin: "4px 0 0", color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
            A short interactive walkthrough using a fictional case: you've received a report of a bird beside a road, unable to fly.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/tutorial")}>
          Start tutorial
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            void buildInterfaceTourSteps(settings.workspace).then((steps) => startGuidance("interface-tour", steps));
          }}
        >
          Interface tour
        </button>
      </div>

      <h2 className="section-label" style={{ marginTop: "var(--space-6)" }}>Fictional demo incidents</h2>
      <div className="card-list">
        {demos.map((d) => (
          <div key={d.id} className="incident-card" style={{ cursor: "default" }}>
            <div className="ic-body">
              <div className="row between" style={{ gap: 8 }}>
                <p className="ic-title">{animalLabel(d)}</p>
                <StatusBadge status={d.status} />
              </div>
              <p className="ic-meta">{d.humanReference} · {d.summary}</p>
              <p className="ic-meta">Last update {relativeTime(d.updatedAt)}</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    // Persist the demo, open it, and launch the DEMO incident
                    // explanation tour (a different guidance system from the
                    // interface tour and the guided tutorial).
                    void putIncident(d).then(() => {
                      navigate(`/incidents/${d.id}`);
                      setTimeout(() => startGuidance("demo-incident-tour", buildDemoTourSteps()), 150);
                    });
                  }}
                >
                  Open example
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => void copyDemo(d)}>
                  Copy into my workspace
                </button>
              </div>
            </div>
            <span className="demo-banner" style={{ alignSelf: "flex-start" }}>FICTIONAL DEMO</span>
          </div>
        ))}
      </div>

      {!hasCopied && (
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem", marginTop: "var(--space-4)" }}>
          “Copy into my workspace” creates a real, editable incident in your own list with a new reference number.
        </p>
      )}
    </main>
  );
}


