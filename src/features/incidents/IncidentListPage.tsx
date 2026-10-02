/**
 * My Reports (Reporter) / Incidents (Professional).
 *
 * Search is always visible at the top with a "/" keyboard shortcut;
 * filters live in an obvious button with a popover and applied-filter
 * chips; each card is a compact report card whose body opens the report,
 * with a labeled ⋯ menu for secondary actions.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { BearPawMark } from "../../components/BrandMark";
import { EmptyState } from "../../components/ui";
import { Dialog } from "../../components/Dialog";
import { useIncidents } from "./IncidentCard";
import { moveToTrash, restoreFromTrash, permanentlyDelete, archiveIncident, unarchiveIncident } from "../../storage/incidentService";
import { putIncident } from "../../storage/repositories";
import { matchesSearch } from "../../utils/text";
import { STATUS_LABELS_BY_KEY, INCIDENT_TYPES, ANIMAL_GROUPS } from "./labels";
import { animalLabel } from "../export/exportService";
import { formatDateTime, relativeTime } from "../../utils/time";
import type { Incident, IncidentStatus } from "../../types/incident";

type View = "active" | "archive" | "trash";

export function IncidentListPage() {
  const { incidents, refresh } = useIncidents();
  const { showToast, settings } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Incident | null>(null);

  // Filters (popover state)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const view = (searchParams.get("view") as View) ?? "active";
  const setView = (v: View) => setSearchParams(v === "active" ? {} : { view: v });
  const isReporter = settings.workspace === "reporter";

  // "/" focuses search when not typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (e.key === "/" && !typing && !document.querySelector(".dialog-backdrop")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (statusFilter !== "all") chips.push({ key: "status", label: STATUS_LABELS_BY_KEY[statusFilter as IncidentStatus] ?? statusFilter, clear: () => setStatusFilter("all") });
    if (typeFilter !== "all") chips.push({ key: "type", label: INCIDENT_TYPES.find((t) => t.value === typeFilter)?.label ?? typeFilter, clear: () => setTypeFilter("all") });
    if (groupFilter !== "all") chips.push({ key: "group", label: ANIMAL_GROUPS.find((g) => g.value === groupFilter)?.label ?? groupFilter, clear: () => setGroupFilter("all") });
    if (dateFrom) chips.push({ key: "from", label: `From ${dateFrom}`, clear: () => setDateFrom("") });
    if (dateTo) chips.push({ key: "to", label: `Until ${dateTo}`, clear: () => setDateTo("") });
    return chips;
  }, [statusFilter, typeFilter, groupFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    let list = incidents.filter((i) => !i.isDemo);
    if (view === "archive") list = list.filter((i) => i.archivedAt && !i.deletedAt);
    else if (view === "trash") list = list.filter((i) => i.deletedAt);
    else list = list.filter((i) => !i.archivedAt && !i.deletedAt);

    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (typeFilter !== "all") list = list.filter((i) => i.incidentType === typeFilter);
    if (groupFilter !== "all") list = list.filter((i) => i.animal.group === groupFilter);
    if (dateFrom) list = list.filter((i) => (i.occurredAt ?? i.createdAt) >= dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((i) => (i.occurredAt ?? i.createdAt) <= to.toISOString());
    }
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
            STATUS_LABELS_BY_KEY[i.status],
            i.tags.join(" "),
            ...i.contacts.map((c) => `${c.name} ${c.organization}`),
            ...i.notes.map((n) => n.text),
          ],
          query
        )
      );
    }
    return list.sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "") || b.updatedAt.localeCompare(a.updatedAt));
  }, [incidents, view, statusFilter, typeFilter, groupFilter, dateFrom, dateTo, query]);

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
        <h1 style={{ margin: 0 }}>{isReporter ? "My reports" : "Incidents"}</h1>
        <Link to="/incidents/new" className="btn btn-primary">
          <Icons.plus size={16} />
          {isReporter ? "Report wildlife" : "Create incident"}
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
        <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-3)" }} data-tour-id="incident-filters">
          <div className="reports-search-row">
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 12, top: 12, color: "var(--c-ink-faint)" }} aria-hidden="true"><Icons.search size={17} /></span>
              <input
                ref={searchInputRef}
                id="incident-search"
                data-tour-id="incident-search"
                className="input"
                style={{ paddingLeft: 38, paddingRight: 44 }}
                placeholder={isReporter ? "Search my reports…" : "Search by reference, species, location, organization, notes…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={isReporter ? "Search my reports" : "Search incidents"}
              />
              <kbd className="kbd-hint" aria-hidden="true">/</kbd>
            </div>
            <button
              className="btn btn-secondary"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
              style={{ gap: 6 }}
            >
              <Icons.list size={15} />
              Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
            </button>
          </div>

          {filtersOpen && (
            <div className="filters-popover" role="group" aria-label="Filters">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="filter-status">Status</label>
                  <select id="filter-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    {Object.entries(STATUS_LABELS_BY_KEY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-type">Incident type</label>
                  <select id="filter-type" className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">All types</option>
                    {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-group">Animal group</label>
                  <select id="filter-group" className="input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                    <option value="all">All animal groups</option>
                    {ANIMAL_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-date">Date range</label>
                  <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <input id="filter-date" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
                    <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
                  </div>
                </div>
              </div>
              <div className="row between">
                <button className="btn btn-quiet btn-sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setGroupFilter("all"); setDateFrom(""); setDateTo(""); }}>
                  Clear all
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setFiltersOpen(false)}>Done</button>
              </div>
            </div>
          )}

          {activeFilters.length > 0 && (
            <div className="row" style={{ marginTop: "var(--space-3)" }} aria-label="Applied filters">
              {activeFilters.map((f) => (
                <button key={f.key} className="filter-chip" onClick={f.clear} aria-label={`Remove filter ${f.label}`}>
                  {f.label} <Icons.x size={12} />
                </button>
              ))}
              <button className="btn btn-quiet btn-sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setGroupFilter("all"); setDateFrom(""); setDateTo(""); }}>
                Clear all
              </button>
            </div>
          )}
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
          {view === "active" && !query && activeFilters.length === 0 ? (
            <EmptyState
              icon={<BearPawMark size={48} tile={false} style={{ color: "var(--brand-icon-bg)" }} />}
              title={isReporter ? "No reports yet" : "No incidents yet"}
              hint={isReporter
                ? "Report wildlife to start recording what you see — observations, photos and handoffs."
                : "Create your first incident to start recording observations and handoffs."}
              action={
                <Link to="/incidents/new" className="btn btn-primary">
                  <Icons.plus size={16} /> {isReporter ? "Report wildlife" : "Create incident"}
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
            <ReportCard
              key={i.id}
              incident={i}
              view={view}
              onPin={() => void putIncident({ ...i, pinnedAt: i.pinnedAt ? null : new Date().toISOString() }).then(refresh)}
              onArchive={() => void archiveIncident(i).then(refresh).then(() => showToast("Incident archived"))}
              onTrash={() => void handleTrash(i)}
              onUnarchive={() => void unarchiveIncident(i).then(refresh).then(() => showToast("Incident unarchived"))}
              onRestore={() => void restoreFromTrash(i).then(refresh).then(() => showToast("Restored from Trash"))}
              onDeleteForever={() => setPendingDelete(i)}
            />
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

/** Compact report card: body opens the report; ⋯ menu for secondary actions; status in the footer. */
function ReportCard({
  incident, view, onPin, onArchive, onTrash, onUnarchive, onRestore, onDeleteForever,
}: {
  incident: Incident;
  view: View;
  onPin: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onUnarchive: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const last = [...incident.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? []);
        const idx = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        items[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey, true); };
  }, [menuOpen]);

  return (
    <div
      className="report-card"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/incidents/${incident.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement) === e.currentTarget) navigate(`/incidents/${incident.id}`); }}
      aria-label={`${animalLabel(incident)} — ${STATUS_LABELS_BY_KEY[incident.status]}`}
    >
      <div className="rc-top">
        <p className="ic-title">{animalLabel(incident)}</p>
        <div className="ic-menu" ref={menuRef}>
          <button
            className="btn btn-quiet btn-sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${incident.humanReference}`}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Icons.list size={15} />
          </button>
          {menuOpen && (
            <div className="ic-menu-pop" role="menu" aria-label={`Actions for ${incident.humanReference}`}>
              {view === "active" && (
                <>
                  <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin(); }}>
                    <Icons.pin size={15} /> {incident.pinnedAt ? "Unpin" : "Pin to top"}
                  </button>
                  <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(); }}>
                    <Icons.archive size={15} /> Archive
                  </button>
                  <button role="menuitem" className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onTrash(); }}>
                    <Icons.trash size={15} /> Move to Trash
                  </button>
                </>
              )}
              {view === "archive" && (
                <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onUnarchive(); }}>
                  <Icons.undo size={15} /> Unarchive
                </button>
              )}
              {view === "trash" && (
                <>
                  <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRestore(); }}>
                    <Icons.undo size={15} /> Restore
                  </button>
                  <button role="menuitem" className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteForever(); }}>
                    <Icons.trash size={15} /> Delete permanently
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="ic-meta">
        {incident.humanReference} · {formatDateTime(incident.occurredAt ?? incident.createdAt)}
        {incident.location.description ? ` · ${incident.location.description}` : ""}
      </p>
      {last && <p className="ic-updates">Last update: {last.summary} · {relativeTime(last.timestamp)}</p>}
      <div className="rc-footer">
        <span className="badge" data-status={incident.status}>{STATUS_LABELS_BY_KEY[incident.status]}</span>
        <span style={{ marginLeft: "auto", color: "var(--c-ink-faint)", display: "inline-flex", paddingRight: 4 }} aria-hidden="true">
          <Icons.chevronRight size={18} />
        </span>
      </div>
    </div>
  );
}
