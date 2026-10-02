/** Incidents list: search, filters, pinned, archive and Trash views with safe delete. */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { EmptyState } from "../../components/ui";
import { Dialog } from "../../components/Dialog";
import { useIncidents, IncidentCardFull } from "./IncidentCard";
import { moveToTrash, restoreFromTrash, permanentlyDelete, archiveIncident, unarchiveIncident } from "../../storage/incidentService";
import { putIncident } from "../../storage/repositories";
import { matchesSearch } from "../../utils/text";
import { STATUS_LABELS_BY_KEY } from "./labels";
import { INCIDENT_TYPES } from "./labels";
import type { Incident } from "../../types/incident";

type View = "active" | "archive" | "trash";


export function IncidentListPage() {
  const { incidents, refresh } = useIncidents();
  const { showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<Incident | null>(null);

  const view = (searchParams.get("view") as View) ?? "active";
  const setView = (v: View) => setSearchParams(v === "active" ? {} : { view: v });

  const filtered = useMemo(() => {
    if (!incidents) return [];
    let list = incidents.filter((i) => !i.isDemo);
    if (view === "archive") list = list.filter((i) => i.archivedAt && !i.deletedAt);
    else if (view === "trash") list = list.filter((i) => i.deletedAt);
    else list = list.filter((i) => !i.archivedAt && !i.deletedAt);

    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (typeFilter !== "all") list = list.filter((i) => i.incidentType === typeFilter);
    if (query.trim()) {
      list = list.filter((i) =>
        matchesSearch(
          [
            i.humanReference,
            i.animal.species,
            i.animal.description,
            i.animal.group,
            i.location.description,
            i.location.landmark,
            i.summary,
            i.tags.join(" "),
            ...i.contacts.map((c) => `${c.name} ${c.organization}`),
            ...i.notes.map((n) => n.text),
          ],
          query
        )
      );
    }
    return list.sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "") || b.updatedAt.localeCompare(a.updatedAt));
  }, [incidents, view, statusFilter, typeFilter, query]);

  async function handleTrash(incident: Incident) {
    await moveToTrash(incident);
    showToast("Moved to Trash", { actionLabel: "Undo", onAction: () => void restoreFromTrash(incident).then(refresh) });
    await refresh();
  }

  const counts = useMemo(() => {
    if (!incidents) return { active: 0, archive: 0, trash: 0 };
    const live = incidents.filter((i) => !i.isDemo && !i.deletedAt);
    return {
      active: live.filter((i) => !i.archivedAt).length,
      archive: live.filter((i) => i.archivedAt).length,
      trash: incidents.filter((i) => !i.isDemo && i.deletedAt).length,
    };
  }, [incidents]);

  return (
    <main className="content" id="main-content">
      <div className="row between" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ margin: 0 }}>Incidents</h1>
        <Link to="/incidents/new" className="btn btn-primary">
          <Icons.plus size={16} />
          Create incident
        </Link>
      </div>

      <div className="segmented" style={{ marginBottom: "var(--space-4)" }} role="group" aria-label="View">
        {(["active", "archive", "trash"] as View[]).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {v === "active" ? `Active (${counts.active})` : v === "archive" ? `Archived (${counts.archive})` : `Trash (${counts.trash})`}
          </button>
        ))}
      </div>

      {view === "active" && (
        <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }} data-tour-id="incident-filters">
          <div className="field" style={{ marginBottom: "var(--space-3)" }}>
            <label htmlFor="incident-search" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Search</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: 11, color: "var(--c-ink-faint)" }} aria-hidden="true"><Icons.search size={16} /></span>
              <input
                id="incident-search"
                className="input"
                data-tour-id="incident-search"
                style={{ paddingLeft: 34 }}
                placeholder="Search by reference, species, location, organization, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ minWidth: 180 }}>
              <label htmlFor="filter-status" className="sr-only">Filter by status</label>
              <select id="filter-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABELS_BY_KEY).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label htmlFor="filter-type" className="sr-only">Filter by incident type</label>
              <select id="filter-type" className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {view === "trash" && (
        <div className="notice warning" style={{ marginBottom: "var(--space-4)" }}>
          <Icons.trash size={18} />
          <span>Items in Trash stay here until you delete them permanently. Restoring puts them back where they were.</span>
        </div>
      )}

      {!incidents ? null : filtered.length === 0 ? (
        <div className="card">
          {view === "active" && !query && statusFilter === "all" && typeFilter === "all" ? (
            <EmptyState
              icon={<Icons.paw size={44} />}
              title="No incidents yet"
              hint="Create your first incident to start recording observations and handoffs."
              action={
                <Link to="/incidents/new" className="btn btn-primary">
                  <Icons.plus size={16} /> Create incident
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Icons.search size={40} />}
              title={view === "trash" ? "Trash is empty" : "Nothing matches"}
              hint={view === "trash" ? "Deleted incidents will appear here." : "Try different search terms or filters."}
            />
          )}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map((i) => (
            <div key={i.id} style={{ position: "relative" }} className="list-card-with-actions">
              <IncidentCardFull incident={i} />
              <div className="row" style={{ position: "absolute", top: 8, right: 8 }} role="group" aria-label={`Actions for ${i.humanReference}`}>
                {view === "active" && (
                  <>
                    <button
                      className="btn btn-quiet btn-sm"
                      title={i.pinnedAt ? "Unpin" : "Pin to top"}
                      aria-label={i.pinnedAt ? `Unpin ${i.humanReference}` : `Pin ${i.humanReference}`}
                      onClick={() => void putIncident({ ...i, pinnedAt: i.pinnedAt ? null : new Date().toISOString() }).then(refresh)}
                    >
                      <Icons.pin size={15} style={{ opacity: i.pinnedAt ? 1 : 0.45 }} />
                    </button>
                    <button className="btn btn-quiet btn-sm" title="Archive" aria-label={`Archive ${i.humanReference}`} onClick={() => void archiveIncident(i).then(refresh).then(() => showToast("Incident archived"))}>
                      <Icons.archive size={15} />
                    </button>
                    <button className="btn btn-quiet btn-sm" title="Move to Trash" aria-label={`Move ${i.humanReference} to Trash`} onClick={() => void handleTrash(i)}>
                      <Icons.trash size={15} />
                    </button>
                  </>
                )}
                {view === "archive" && (
                  <button className="btn btn-quiet btn-sm" onClick={() => void unarchiveIncident(i).then(refresh).then(() => showToast("Incident unarchived"))}>
                    <Icons.undo size={15} /> Unarchive
                  </button>
                )}
                {view === "trash" && (
                  <>
                    <button className="btn btn-quiet btn-sm" onClick={() => void restoreFromTrash(i).then(refresh).then(() => showToast("Restored from Trash"))}>
                      <Icons.undo size={15} /> Restore
                    </button>
                    <button className="btn btn-quiet btn-sm" style={{ color: "var(--c-danger)" }} onClick={() => setPendingDelete(i)}>
                      <Icons.trash size={15} /> Delete forever
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        title="Delete permanently?"
        danger
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPendingDelete(null)}>Keep it</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (pendingDelete) {
                  await permanentlyDelete(pendingDelete);
                  showToast("Incident deleted permanently");
                }
                setPendingDelete(null);
                await refresh();
              }}
            >
              Delete permanently
            </button>
          </>
        }
      >
        <p>
          This removes <strong>{pendingDelete?.humanReference}</strong> and all of its timeline history, observations,
          corrections and attached photos from this device. This cannot be undone.
        </p>
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>
          Consider exporting a backup first (Settings → Storage & backups) if you might need this record later.
        </p>
      </Dialog>
    </main>
  );
}
