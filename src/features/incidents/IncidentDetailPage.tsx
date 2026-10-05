/** Incident detail workspace: overview, timeline, observations, attachments, people & handoffs, details, export. */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { useTranslation } from "react-i18next";
import { UpdateReportDialog } from "./UpdateReportDialog";
import { Icons } from "../../components/Icons";
import { Dialog } from "../../components/Dialog";
import { Select } from "../../components/Select";
import { StatusBadge, ContextHelp } from "../../components/ui";
import { BookmarkButton } from "./BookmarkButton";
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
  { id: "overview", labelKey: "tabsOverview" },
  { id: "timeline", labelKey: "tabsTimeline" },
  { id: "observations", labelKey: "tabsObservations" },
  { id: "attachments", labelKey: "tabsAttachments" },
  { id: "people", labelKey: "tabsPeople" },
  { id: "details", labelKey: "tabsDetails" },
  { id: "export", labelKey: "tabsExport" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearchParams] = useSearchParams();
  const { showToast, settings } = useApp();
  const { t: t2 } = useTranslation("tabs");
  const { t: t3 } = useTranslation("workspace");
  const [incident, setIncident] = useState<Incident | null>(null);
  const [notFound, setNotFound] = useState(false);
  // The URL query is the single source of truth for the active tab.
  // Clicking a tab performs SPA navigation, so Back/Forward and deep links
  // work and no effect can ever revert the user's selection (the old
  // setTab-from-URL effect caused tabs to get "stuck" on Export).
  const urlTab = search.get("tab");
  const tab: TabId = (TABS.some((t) => t.id === urlTab) ? urlTab : "overview") as TabId;
  const setTab = (next: TabId) => {
    const params = new URLSearchParams(search);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: false });
  };
  const [updateDialog, setUpdateDialog] = useState(false);
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
          <span className="demo-banner" data-tour-id="demo-banner">FICTIONAL DEMO</span>
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
            <BookmarkButton incident={incident} size={17} />
            {settings.workspace === "reporter" && (
              <button className="btn btn-primary btn-sm" onClick={() => setUpdateDialog(true)}>
                <Icons.edit size={15} />
                {t2("updateReport", { ns: "reports" })}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" data-tour-id="nav-handoff" onClick={() => setTab("people")}>
              <Icons.handoff size={15} />
              {t3("transferHandoff")}
            </button>
            {incident.status !== "closed" ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setStatusDialog(true)}>
                <Icons.edit size={15} />
                {t3("changeStatus")}
              </button>
            ) : null}
            <button className="btn btn-quiet btn-sm" aria-label={t3("backToIncidents")} onClick={() => navigate("/incidents")}>
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

      <div className="tab-bar" role="tablist" aria-label={t2("sections", { ns: "tabs" })} style={{ marginTop: "var(--space-5)" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-tour-id={`tab-${t.id}`}>
            {t2(t.labelKey, { ns: "tabs" })}
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

      <UpdateReportDialog incident={incident} open={updateDialog} onClose={() => setUpdateDialog(false)} onChanged={bump} />

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
