/** Incident detail workspace: overview, timeline, observations, attachments, people & handoffs, details, export. */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { Dialog } from "../../components/Dialog";
import { Select } from "../../components/Select";
import { StatusBadge, ContextHelp } from "../../components/ui";
import { getIncident, getAttachmentsForIncident } from "../../storage/repositories";
import type { Incident, IncidentStatus } from "../../types/incident";
import { STATUS_LABELS_BY_KEY } from "./labels";
import { animalLabel } from "../export/exportService";
import { custodyWarnings } from "../../storage/incidentService";
import { OverviewTab } from "./detail/OverviewTab";
import { TimelineTab } from "./detail/TimelineTab";
import { ObservationsTab } from "./detail/ObservationsTab";
import { AttachmentsTab } from "./detail/AttachmentsTab";
import { PeopleTab } from "./detail/PeopleTab";
import { DetailsTab } from "./detail/DetailsTab";
import { ExportTab } from "./detail/ExportTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "observations", label: "Observations" },
  { id: "attachments", label: "Attachments" },
  { id: "people", label: "People & handoffs" },
  { id: "details", label: "Incident details" },
  { id: "export", label: "Export" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const search = useSearchParams()[0];
  const { showToast } = useApp();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [notFound, setNotFound] = useState(false);
  const initialTab = (search.get("tab") as TabId) ?? "overview";
  const [tab, setTab] = useState<TabId>(
    (TABS.some((t) => t.id === initialTab) ? initialTab : "overview") as TabId
  );
  // Keep the tab in sync with deep links (e.g. the product tour navigating to ?tab=timeline).
  useEffect(() => {
    const urlTab = search.get("tab") as TabId | null;
    if (urlTab && TABS.some((t) => t.id === urlTab) && urlTab !== tab) setTab(urlTab);
  }, [search, tab]);
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<IncidentStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [reload, setReload] = useState(0);

  const refresh = useCallback(async () => {
    if (!id) return;
    const inc = await getIncident(id);
    if (!inc) {
      setNotFound(true);
      return;
    }
    setIncident(inc);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh, reload]);

  useEffect(() => {
    if (!incident) return;
    let revoke: string[] = [];
    getAttachmentsForIncident(incident.id).then((blobs) => {
      revoke = blobs.map((b) => URL.createObjectURL(b.data));
      void revoke;
    });
    return () => revoke.forEach((u) => URL.revokeObjectURL(u));
  }, [incident?.id, incident?.attachments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = () => {
    setReload((n) => n + 1);
  };

  if (notFound) {
    return (
      <main className="content" id="main-content">
        <div className="card">
          <h2>Incident not found</h2>
          <p>This incident may have been deleted, or the link is incorrect.</p>
          <Link to="/incidents" className="btn btn-primary">Back to incidents</Link>
        </div>
      </main>
    );
  }
  if (!incident) {
    return <main className="content" id="main-content"><p style={{ color: "var(--c-ink-faint)" }}>Loading incident…</p></main>;
  }

  const warnings = custodyWarnings(incident);

  return (
    <main className="content wide" id="main-content">
      {incident.isDemo && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <span className="demo-banner">FICTIONAL DEMO</span>
        </div>
      )}

      <header className="card" data-tour-id="incident-header">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h1 style={{ margin: 0 }}>{animalLabel(incident)}</h1>
              <StatusBadge status={incident.status} />
            </div>
            <p style={{ color: "var(--c-ink-faint)", margin: "4px 0 0", fontSize: "0.88rem" }}>
              {incident.humanReference} · Updated {new Date(incident.updatedAt).toLocaleString()}
            </p>
            <p style={{ color: "var(--c-ink-soft)", margin: "8px 0 0" }}>
              {incident.location.description || <em style={{ color: "var(--c-ink-faint)" }}>Location not recorded</em>}
              {incident.location.precision && <span className="tag" style={{ marginLeft: 8 }}>{incident.location.precision} location</span>}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" data-tour-id="nav-handoff" onClick={() => setTab("people")}>
              <Icons.handoff size={15} />
              Transfer / hand off
            </button>
            {incident.status !== "closed" ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setStatusDialog(true)}>
                <Icons.edit size={15} />
                Change status
              </button>
            ) : null}
            <button className="btn btn-quiet btn-sm" aria-label="Back to incidents" onClick={() => navigate("/incidents")}>
              <Icons.x size={15} />
            </button>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="notice warning" style={{ marginTop: "var(--space-4)" }}>
            <Icons.warning size={18} />
            <div>
              {warnings.map((w) => (
                <p key={w} style={{ margin: 0 }}>{w}</p>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="tab-bar" role="tablist" aria-label="Incident sections" style={{ marginTop: "var(--space-5)" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-tour-id={`tab-${t.id}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="fade-in" key={tab} role="tabpanel">
        {tab === "overview" && <OverviewTab incident={incident} onChanged={bump} />}
        {tab === "timeline" && <TimelineTab incident={incident} />}
        {tab === "observations" && <ObservationsTab incident={incident} onChanged={bump} />}
        {tab === "attachments" && <AttachmentsTab incident={incident} onChanged={bump} />}
        {tab === "people" && <PeopleTab incident={incident} onChanged={bump} />}
        {tab === "details" && <DetailsTab incident={incident} onChanged={bump} />}
        {tab === "export" && <ExportTab incident={incident} />}
      </div>

      <Dialog
        open={statusDialog}
        title="Change status"
        onClose={() => setStatusDialog(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setStatusDialog(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!newStatus}
              onClick={async () => {
                if (newStatus) {
                  const { changeStatus } = await import("../../storage/incidentService");
                  await changeStatus(incident, newStatus, null, statusNote || null);
                  showToast(`Status changed to ${STATUS_LABELS_BY_KEY[newStatus]}`);
                }
                setStatusDialog(false);
                setNewStatus(null);
                setStatusNote("");
                bump();
              }}
            >
              Save status
            </button>
          </>
        }
      >
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
          Status changes become timeline events. The previous status stays visible in history.
        </p>
        <Select
          label="New status"
          value={newStatus}
          options={Object.entries(STATUS_LABELS_BY_KEY).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setNewStatus(v as IncidentStatus)}
        />
        <label htmlFor="status-note" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
          Note <span className="optional">(optional)</span>
        </label>
        <input id="status-note" className="input" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. Volunteer confirmed pickup for 15:00" />
      </Dialog>
    </main>
  );
}

export { ContextHelp };
