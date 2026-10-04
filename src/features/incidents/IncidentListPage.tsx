/**
 * My Reports (Reporter) / Incidents (Professional) — "Incident Command Center".
 *
 * 0.3 overhaul: a lightweight operational summary band (each stat is a
 * toggleable quick filter), List/Table display modes (persisted), a
 * Comfortable/Compact card density (persisted), and a fast right-side case
 * inspector that opens in place instead of navigating away. Saved views
 * (P81), search, filters and the bounded render window (P82) are unchanged.
 *
 * Search is always visible at the top with a "/" keyboard shortcut;
 * filters live in an obvious button with a popover and applied-filter
 * chips; each card is a compact report card whose body opens the
 * inspector, with a labeled ⋯ menu for secondary actions.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Icons } from "../../components/Icons";
import { BearPawMark } from "../../components/BrandMark";
import { EmptyState, StatusBadge } from "../../components/ui";
import { Dialog } from "../../components/Dialog";
import { useIncidents } from "./IncidentCard";
import { moveToTrash, restoreFromTrash, permanentlyDelete, archiveIncident, unarchiveIncident } from "../../storage/incidentService";
import { putIncident, getSetting, setSetting } from "../../storage/repositories";
import { matchesSearch } from "../../utils/text";
import { getAllDrafts, deleteDraft } from "../../storage/repositories";
import type { DraftRecord } from "../../storage/db";
import { STATUS_LABELS_BY_KEY, INCIDENT_TYPES, ANIMAL_GROUPS } from "./labels";
import { animalLabel } from "../export/exportService";
import { formatDateTime, relativeTime } from "../../utils/time";
import { isOpen } from "../network/incidentAnalytics";
import type { Incident, IncidentStatus } from "../../types/incident";

type View = "active" | "archive" | "trash";
type ViewMode = "list" | "table";
type Density = "comfortable" | "compact";
type StatKey = "open" | "unassigned" | "awaitingPickup" | "handoff" | "waiting2h" | "recentlyClosed";
type SortKey = "reference" | "animal" | "status" | "age" | "location" | "assigned" | "handoff" | "updated";
type SortDir = "asc" | "desc";

/** P81 — a named, locally-persisted filter set ("Unassigned >2h", "Birds", …). */
interface SavedView {
  id: string;
  name: string;
  filters: { status: string; type: string; group: string; dateFrom: string; dateTo: string };
}

const SAVED_VIEWS_KEY = "incident-saved-views";
const VIEW_MODE_KEY = "incidents-view-mode";
const DENSITY_KEY = "incidents-density";
const RENDER_STEP = 100; // P82 — bounded DOM; "Load more" reveals the rest

const RESOLVED_STATUSES = new Set<IncidentStatus>(["released", "deceased", "closed", "cancelled"]);

/** Shared predicate for summary-band stats AND their quick filters —
 * one definition, so the number shown always matches what is filtered. */
function statPredicate(key: StatKey, i: Incident, now: number): boolean {
  const startedAt = i.occurredAt ?? i.createdAt;
  switch (key) {
    case "open":
      return isOpen(i);
    case "unassigned":
      // Accepted but nobody currently holds custody.
      return isOpen(i) && !i.custody.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested";
    case "awaitingPickup":
      return isOpen(i) && i.status === "awaiting_pickup";
    case "handoff":
      return isOpen(i) && i.handoffs.some((h) => !h.completedAt);
    case "waiting2h":
      return isOpen(i) && now - new Date(startedAt).getTime() > 2 * 3600_000;
    case "recentlyClosed":
      return !i.deletedAt && !i.archivedAt && RESOLVED_STATUSES.has(i.status) && now - new Date(i.updatedAt).getTime() < 24 * 3600_000;
  }
}

const STAT_KEYS: StatKey[] = ["open", "unassigned", "awaitingPickup", "handoff", "waiting2h", "recentlyClosed"];
const STAT_LABEL_KEYS: Record<StatKey, string> = {
  open: "professional:ccStatOpen",
  unassigned: "professional:ccStatUnassigned",
  awaitingPickup: "professional:ccStatAwaitingPickup",
  handoff: "professional:ccStatHandoff",
  waiting2h: "professional:ccStatWaiting2h",
  recentlyClosed: "professional:ccStatRecentlyClosed",
};

/** Map Reporter summary-card categories to status filters (deep-linkable). */
function statusesForCategory(category: string | null): string[] | null {
  if (category === "awaiting") return ["reported", "response_requested"];
  if (category === "active") return ["responder_assigned", "awaiting_pickup", "in_transport", "transferred", "in_care", "veterinary_care", "monitoring"];
  if (category === "resolved") return ["released", "closed", "cancelled", "deceased"];
  return null;
}

function currentHolder(i: Incident) {
  return i.custody.filter((c) => !c.endedAt).at(-1);
}

function lastUpdateOf(i: Incident) {
  return [...i.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

function handoffStateOf(i: Incident): "pending" | "complete" | "none" {
  if (i.handoffs.length === 0) return "none";
  return i.handoffs.some((h) => !h.completedAt) ? "pending" : "complete";
}

export function IncidentListPage() {
  const { incidents, refresh } = useIncidents();
  const { showToast, settings } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Incident | null>(null);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [reloadDrafts, setReloadDrafts] = useState(0);

  // Command-center display state (persisted locally).
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [density, setDensity] = useState<Density>("comfortable");
  const [statFilter, setStatFilter] = useState<StatKey | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  // Filters (popover state); deep-linkable via ?status=
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(() => (searchParams.get("status") as string) ?? "all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [renderLimit, setRenderLimit] = useState(RENDER_STEP);

  const categoryParam = searchParams.get("category");
  const categoryStatuses = statusesForCategory(categoryParam);
  const view = (searchParams.get("view") as View) ?? "active";
  const setView = (v: View) => setSearchParams(v === "active" ? {} : { view: v });
  const isReporter = settings.workspace === "reporter";

  useEffect(() => {
    void getSetting<ViewMode>(VIEW_MODE_KEY).then((m) => {
      if (m === "list" || m === "table") setViewMode(m);
    });
    void getSetting<Density>(DENSITY_KEY).then((d) => {
      if (d === "comfortable" || d === "compact") setDensity(d);
    });
  }, []);

  const changeViewMode = (m: ViewMode) => {
    setViewMode(m);
    void setSetting(VIEW_MODE_KEY, m);
  };
  const changeDensity = (d: Density) => {
    setDensity(d);
    void setSetting(DENSITY_KEY, d);
  };

  useEffect(() => {
    if (view !== "active") return;
    getAllDrafts().then((d) => setDrafts([...d].sort((a, b) => b.savedAt.localeCompare(a.savedAt))));
  }, [view, reloadDrafts]);

  // P81 — saved views live in the local settings store.
  useEffect(() => {
    getSetting<SavedView[]>(SAVED_VIEWS_KEY).then((v) => {
      if (Array.isArray(v)) setSavedViews(v);
    });
  }, []);

  // P82 — new filter context restarts the bounded render window.
  useEffect(() => {
    setRenderLimit(RENDER_STEP);
  }, [statusFilter, typeFilter, groupFilter, dateFrom, dateTo, query, view, statFilter, sort]);

  // Escape closes the inspector (unless a modal dialog owns the keystroke).
  useEffect(() => {
    if (!inspectorId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".dialog-backdrop")) setInspectorId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inspectorId]);

  const saveCurrentView = async () => {
    const name = newViewName.trim();
    if (!name) return;
    const sv: SavedView = {
      id: (crypto.randomUUID?.() ?? `view-${Date.now()}`),
      name,
      filters: { status: statusFilter, type: typeFilter, group: groupFilter, dateFrom, dateTo },
    };
    const next = [...savedViews, sv];
    setSavedViews(next);
    await setSetting(SAVED_VIEWS_KEY, next);
    setNewViewName("");
    showToast(t("reports:viewSaved", { defaultValue: "View saved" }));
  };

  const applySavedView = (v: SavedView) => {
    setStatusFilter(v.filters.status);
    setTypeFilter(v.filters.type);
    setGroupFilter(v.filters.group);
    setDateFrom(v.filters.dateFrom);
    setDateTo(v.filters.dateTo);
  };

  const removeSavedView = async (id: string) => {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    await setSetting(SAVED_VIEWS_KEY, next);
    showToast(t("reports:viewRemoved", { defaultValue: "View removed" }));
  };

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

  // Shared "now" so stat counts and quick filtering agree.
  const now = useMemo(() => Date.now(), [incidents]);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    let list = incidents.filter((i) => !i.isDemo);
    if (view === "archive") list = list.filter((i) => i.archivedAt && !i.deletedAt);
    else if (view === "trash") list = list.filter((i) => i.deletedAt);
    else list = list.filter((i) => !i.archivedAt && !i.deletedAt);

    if (categoryStatuses) list = list.filter((i) => categoryStatuses.includes(i.status));
    else if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (typeFilter !== "all") list = list.filter((i) => i.incidentType === typeFilter);
    if (groupFilter !== "all") list = list.filter((i) => i.animal.group === groupFilter);
    if (dateFrom) list = list.filter((i) => (i.occurredAt ?? i.createdAt) >= dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((i) => (i.occurredAt ?? i.createdAt) <= to.toISOString());
    }
    if (statFilter) list = list.filter((i) => statPredicate(statFilter, i, now));
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
  }, [incidents, view, statusFilter, typeFilter, groupFilter, dateFrom, dateTo, query, statFilter, now, categoryStatuses]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    const valueFor = (i: Incident): string | number => {
      switch (sort.key) {
        case "reference": return i.humanReference;
        case "animal": return animalLabel(i).toLowerCase();
        case "status": return STATUS_LABELS_BY_KEY[i.status] ?? i.status;
        case "age": return new Date(i.occurredAt ?? i.createdAt).getTime();
        case "location": return (i.location.description ?? i.location.landmark ?? "").toLowerCase();
        case "assigned": return (currentHolder(i)?.holder ?? "").toLowerCase();
        case "handoff": {
          const state = handoffStateOf(i);
          return state === "pending" ? 0 : state === "complete" ? 1 : 2;
        }
        case "updated": return new Date(i.updatedAt).getTime();
      }
    };
    return [...filtered].sort((a, b) => {
      const va = valueFor(a);
      const vb = valueFor(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  // Summary-band counts over the current view's live scope (same
  // deleted/archived/demo rules as the list itself).
  const stats = useMemo(() => {
    const base = (incidents ?? []).filter((i) => {
      if (i.isDemo) return false;
      if (view === "archive") return Boolean(i.archivedAt) && !i.deletedAt;
      if (view === "trash") return Boolean(i.deletedAt);
      return !i.archivedAt && !i.deletedAt;
    });
    const out = {} as Record<StatKey, number>;
    for (const key of STAT_KEYS) out[key] = base.filter((i) => statPredicate(key, i, now)).length;
    return out;
  }, [incidents, view, now]);

  const toggleStat = (key: StatKey) => setStatFilter((cur) => (cur === key ? null : key));

  const selected = useMemo(
    () => (incidents ?? []).find((i) => i.id === inspectorId) ?? null,
    [incidents, inspectorId]
  );

  async function handleTrash(incident: Incident) {
    await moveToTrash(incident);
    showToast(t("reports:trashedToast"), { actionLabel: t("undo"), onAction: () => void restoreFromTrash(incident).then(refresh) });
    await refresh();
  }

  const rowActions: RowActionHandlers = {
    onPin: (i) => void putIncident({ ...i, pinnedAt: i.pinnedAt ? null : new Date().toISOString() }).then(refresh),
    onArchive: (i) => void archiveIncident(i).then(refresh).then(() => showToast(t("reports:archivedToast"))),
    onTrash: (i) => void handleTrash(i),
    onUnarchive: (i) => void unarchiveIncident(i).then(refresh).then(() => showToast(t("reports:unarchivedToast"))),
    onRestore: (i) => void restoreFromTrash(i).then(refresh).then(() => showToast(t("reports:restoredToast"))),
    onDeleteForever: (i) => setPendingDelete(i),
  };

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
        <h1 style={{ margin: 0 }}>{isReporter ? t("navigation:myReports") : t("navigation:incidents")}</h1>
        <Link to="/incidents/new" className="btn btn-primary">
          <Icons.plus size={16} />
          {isReporter ? t("navigation:reportWildlife") : t("navigation:createIncident")}
        </Link>
      </div>

      <div className="segmented" style={{ marginBottom: "var(--space-4)" }} role="group" aria-label="View">
        {(["active", "archive", "trash"] as View[]).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {v === "active" ? `${t("reports:viewActive")} (${counts.active})` : v === "archive" ? `${t("reports:viewArchived")} (${counts.archive})` : `${t("reports:viewTrash")} (${counts.trash})`}
          </button>
        ))}
      </div>

      {view === "active" && (
        <div
          className="card"
          role="group"
          aria-label={t("professional:ccSummaryAria", { defaultValue: "Operational summary" })}
          data-testid="summary-band"
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", padding: "var(--space-3)", marginBottom: "var(--space-3)", alignItems: "center" }}
        >
          {STAT_KEYS.map((key) => (
            <button
              key={key}
              className="btn btn-quiet btn-sm"
              aria-pressed={statFilter === key}
              onClick={() => toggleStat(key)}
              style={{ gap: 6 }}
            >
              {t(STAT_LABEL_KEYS[key])} <strong>{stats[key]}</strong>
            </button>
          ))}
          {statFilter && (
            <button className="btn btn-quiet btn-sm" onClick={() => setStatFilter(null)}>
              {t("reports:clearAll")}
            </button>
          )}
        </div>
      )}

      <div className="row between" style={{ marginBottom: "var(--space-3)", flexWrap: "wrap", gap: 8 }}>
        <div className="segmented" role="group" aria-label={t("professional:ccDisplay", { defaultValue: "Display" })}>
          <button aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}>
            {t("professional:ccModeList", { defaultValue: "List" })}
          </button>
          <button aria-pressed={viewMode === "table"} onClick={() => changeViewMode("table")}>
            {t("professional:ccModeTable", { defaultValue: "Table" })}
          </button>
        </div>
        {viewMode === "list" && (
          <div className="segmented" role="group" aria-label={t("professional:ccDensityLabel", { defaultValue: "Density" })}>
            <button aria-pressed={density === "comfortable"} onClick={() => changeDensity("comfortable")}>
              {t("professional:ccDensityComfortable", { defaultValue: "Comfortable" })}
            </button>
            <button aria-pressed={density === "compact"} onClick={() => changeDensity("compact")}>
              {t("professional:ccDensityCompact", { defaultValue: "Compact" })}
            </button>
          </div>
        )}
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
                placeholder={isReporter ? t("reports:searchPlaceholder") : t("reports:searchPlaceholderPro")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={isReporter ? t("reports:search") : t("reports:searchPro")}
              />
              <kbd className="kbd-hint" aria-hidden="true">/</kbd>
            </div>
            <button
              className="btn btn-secondary"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
              style={{ gap: 6 }}
              data-tour-id="filters-button"
            >
              <Icons.list size={15} />
              {activeFilters.length > 0 ? t("reports:filtersCount", { count: activeFilters.length }) : t("reports:filters")}
            </button>
          </div>

          {filtersOpen && (
            <div className="filters-popover" role="group" aria-label="Filters">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="filter-status">{t("reports:filterStatus")}</label>
                  <select id="filter-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">{t("reports:allStatuses")}</option>
                    {Object.entries(STATUS_LABELS_BY_KEY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-type">{t("reports:filterType")}</label>
                  <select id="filter-type" className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">{t("reports:allTypes")}</option>
                    {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-group">{t("reports:filterGroup")}</label>
                  <select id="filter-group" className="input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                    <option value="all">{t("reports:allGroups")}</option>
                    {ANIMAL_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="filter-date">{t("reports:filterDate")}</label>
                  <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <input id="filter-date" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label={t("reports:from")} />
                    <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label={t("reports:until")} />
                  </div>
                </div>
              </div>
              <div className="row between" style={{ marginTop: "var(--space-3)", flexWrap: "wrap", gap: 8 }}>
                <div className="row" style={{ gap: 6 }} data-tour-id="saved-view-controls">
                  <input
                    className="input"
                    style={{ width: 180 }}
                    placeholder={t("reports:savedViewName", { defaultValue: "View name" })}
                    aria-label={t("reports:savedViewName", { defaultValue: "View name" })}
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveCurrentView(); }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={() => void saveCurrentView()} disabled={!newViewName.trim()}>
                    {t("reports:saveView", { defaultValue: "Save view" })}
                  </button>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-quiet btn-sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setGroupFilter("all"); setDateFrom(""); setDateTo(""); }}>
                    {t("reports:clearAll")}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setFiltersOpen(false)}>{t("done")}</button>
                </div>
              </div>
            </div>
          )}

          {activeFilters.length > 0 && (
            <div className="row" style={{ marginTop: "var(--space-3)" }} aria-label={t("reports:appliedFilters")}>
              {activeFilters.map((f) => (
                <button key={f.key} className="filter-chip" onClick={f.clear} aria-label={t("reports:removeFilter", { label: f.label })}>
                  {f.label} <Icons.x size={12} />
                </button>
              ))}
              <button className="btn btn-quiet btn-sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setGroupFilter("all"); setDateFrom(""); setDateTo(""); }}>
                {t("reports:clearAll")}
              </button>
            </div>
          )}
        </div>
      )}

      {view === "active" && savedViews.length > 0 && (
        <div className="row" style={{ marginBottom: "var(--space-3)", flexWrap: "wrap", gap: 8 }} aria-label={t("reports:savedViews", { defaultValue: "Saved views" })} data-testid="saved-views">
          <span className="section-label" style={{ margin: 0 }}>{t("reports:savedViews", { defaultValue: "Saved views" })}</span>
          {savedViews.map((v) => (
            <span key={v.id} className="filter-chip" style={{ gap: 6 }}>
              <button
                onClick={() => applySavedView(v)}
                aria-label={t("reports:applyView", { defaultValue: "Apply view {{name}}", name: v.name })}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
              >
                {v.name}
              </button>
              <button
                onClick={() => void removeSavedView(v.id)}
                aria-label={t("reports:removeView", { defaultValue: "Remove view {{name}}", name: v.name })}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", color: "inherit" }}
              >
                <Icons.x size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {view === "active" && drafts.length > 0 && (
        <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }} aria-label={t("home:drafts")}>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>{t("home:drafts")}</h3>
          <div className="stack">
            {drafts.map((d) => (
              <div key={d.id} className="row between" style={{ gap: 12 }}>
                <span style={{ fontSize: "0.9rem", color: "var(--c-ink-soft)" }}>
                  {t("home:draftStarted", { when: relativeTime(d.savedAt) })}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate("/incidents/new?resume=1")}>{t("home:draftContinue")}</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => void deleteDraft(d.id).then(() => setReloadDrafts((n) => n + 1))}>{t("home:draftDiscard")}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "trash" && (
        <div className="notice warning" style={{ marginBottom: "var(--space-4)" }}>
          <Icons.trash size={18} />
          <span>{t("reports:trashNote")}</span>
        </div>
      )}

      {!incidents ? null : sorted.length === 0 ? (
        <div className="card">
          {view === "active" && !query && activeFilters.length === 0 && !statFilter ? (
            <EmptyState
              icon={<BearPawMark size={48} tile={false} style={{ color: "var(--brand-icon-bg)" }} />}
              title={isReporter ? t("reports:title") : t("home:noIncidents")}
              hint={isReporter ? t("home:noReportsHint") : t("home:noIncidentsHint")}
              action={
                <Link to="/incidents/new" className="btn btn-primary">
                  <Icons.plus size={16} /> {isReporter ? t("navigation:reportWildlife") : t("navigation:createIncident")}
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Icons.search size={40} />}
              title={view === "trash" ? t("reports:trashEmpty") : t("reports:nothingMatches")}
              hint={view === "trash" ? t("reports:trashEmptyHint") : t("reports:nothingMatchesHint")}
            />
          )}
        </div>
      ) : viewMode === "table" ? (
        <IncidentTable
          rows={sorted.slice(0, renderLimit)}
          view={view}
          sort={sort}
          onSort={(key) =>
            setSort((cur) =>
              cur && cur.key === key
                ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
                : { key, dir: key === "age" || key === "updated" ? "desc" : "asc" }
            )
          }
          onOpen={(i) => setInspectorId(i.id)}
          actions={rowActions}
        />
      ) : (
        <div className="card-list">
          {sorted.slice(0, renderLimit).map((i) => (
            <ReportCard
              key={i.id}
              incident={i}
              view={view}
              density={density}
              onOpen={() => setInspectorId(i.id)}
              onPin={() => rowActions.onPin(i)}
              onArchive={() => rowActions.onArchive(i)}
              onTrash={() => rowActions.onTrash(i)}
              onUnarchive={() => rowActions.onUnarchive(i)}
              onRestore={() => rowActions.onRestore(i)}
              onDeleteForever={() => rowActions.onDeleteForever(i)}
            />
          ))}
        </div>
      )}

      {sorted.length > renderLimit && (
        <div className="card" style={{ marginTop: "var(--space-3)", textAlign: "center" }}>
          <p className="hint" style={{ margin: 0 }}>
            {t("reports:showingOf", { defaultValue: "Showing {{shown}} of {{total}} reports", shown: renderLimit, total: sorted.length })}
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setRenderLimit((n) => n + RENDER_STEP)}>
            {t("reports:loadMore", { defaultValue: "Load more" })}
          </button>
        </div>
      )}

      {selected && <InspectorPanel incident={selected} onClose={() => setInspectorId(null)} />}

      <Dialog
        open={pendingDelete !== null}
        title={t("reports:deleteTitle")}
        danger
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPendingDelete(null)}>{t("reports:keepIt")}</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (pendingDelete) {
                  await permanentlyDelete(pendingDelete);
                  showToast(t("reports:deletedToast"));
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
        <p>{t("reports:deleteBody", { ref: pendingDelete?.humanReference ?? "" })}</p>
        <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>
          {t("reports:deleteBackupHint")}
        </p>
      </Dialog>
    </main>
  );
}

/** ⋯ actions menu, shared by list cards and table rows. */
function RowActionsMenu({
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
  const { t } = useTranslation();

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
    <div className="ic-menu" ref={menuRef}>
      <button
        className="btn btn-quiet btn-sm"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("reports:actionsFor", { ref: incident.humanReference })}
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
                <Icons.pin size={15} /> {incident.pinnedAt ? t("reports:unpin") : t("reports:pin")}
              </button>
              <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(); }}>
                <Icons.archive size={15} /> {t("reports:archive")}
              </button>
              <button role="menuitem" className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onTrash(); }}>
                <Icons.trash size={15} /> {t("reports:moveToTrash")}
              </button>
            </>
          )}
          {view === "archive" && (
            <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onUnarchive(); }}>
              <Icons.undo size={15} /> {t("reports:unarchive")}
            </button>
          )}
          {view === "trash" && (
            <>
              <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRestore(); }}>
                <Icons.undo size={15} /> {t("reports:restore")}
              </button>
              <button role="menuitem" className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteForever(); }}>
                <Icons.trash size={15} /> {t("reports:deletePermanently")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface RowActionHandlers {
  onPin: (i: Incident) => void;
  onArchive: (i: Incident) => void;
  onTrash: (i: Incident) => void;
  onUnarchive: (i: Incident) => void;
  onRestore: (i: Incident) => void;
  onDeleteForever: (i: Incident) => void;
}

/** Professional sortable table (0.3) — bounded by the caller's render window. */
function IncidentTable({
  rows, view, sort, onSort, onOpen, actions,
}: {
  rows: Incident[];
  view: View;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey) => void;
  onOpen: (i: Incident) => void;
  actions: RowActionHandlers;
}) {
  const { t } = useTranslation();
  const columns: { key: SortKey; label: string; defaultDir: SortDir }[] = [
    { key: "reference", label: t("professional:ccColReference", { defaultValue: "Reference" }), defaultDir: "asc" },
    { key: "animal", label: t("professional:ccColAnimal", { defaultValue: "Animal" }), defaultDir: "asc" },
    { key: "status", label: t("professional:ccColStatus", { defaultValue: "Status" }), defaultDir: "asc" },
    { key: "age", label: t("professional:ccColAge", { defaultValue: "Age" }), defaultDir: "desc" },
    { key: "location", label: t("professional:ccColLocation", { defaultValue: "Location" }), defaultDir: "asc" },
    { key: "assigned", label: t("professional:ccColAssigned", { defaultValue: "Assigned" }), defaultDir: "asc" },
    { key: "handoff", label: t("professional:ccColHandoff", { defaultValue: "Handoff" }), defaultDir: "asc" },
    { key: "updated", label: t("professional:ccColUpdated", { defaultValue: "Last update" }), defaultDir: "desc" },
  ];

  return (
    <div className="card" style={{ padding: "var(--space-2)" }}>
      <div className="ops-table-wrap">
        <table className="ops-table" aria-label={t("professional:ccTableAria", { defaultValue: "Incidents table" })}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                // The button's accessible name describes what clicking DOES next:
                // an inactive column sorts by its default direction; an active
                // one flips.
                const dirAfterClick = active ? (sort!.dir === "asc" ? "desc" : "asc") : c.defaultDir;
                const nextLabel = t(
                  dirAfterClick === "asc" ? "professional:ccSortAsc" : "professional:ccSortDesc",
                  { defaultValue: dirAfterClick === "asc" ? "Sort {{col}} ascending" : "Sort {{col}} descending", col: c.label }
                );
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button
                      className="btn btn-quiet btn-sm"
                      aria-label={nextLabel}
                      onClick={() => onSort(c.key)}
                      style={{ padding: "2px 6px" }}
                    >
                      {c.label}
                      {active && <span aria-hidden="true">{sort!.dir === "asc" ? " ↑" : " ↓"}</span>}
                    </button>
                  </th>
                );
              })}
              <th scope="col">
                <span className="section-label" style={{ fontSize: "0.78rem" }}>{t("professional:ccColActions", { defaultValue: "Actions" })}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const holder = currentHolder(i);
              const handoff = handoffStateOf(i);
              return (
                <tr
                  key={i.id}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpen(i)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement) === e.currentTarget) {
                      e.preventDefault();
                      onOpen(i);
                    }
                  }}
                >
                  <td><bdi>{i.humanReference}</bdi></td>
                  <td>{animalLabel(i)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>{relativeTime(i.occurredAt ?? i.createdAt)}</td>
                  <td>{i.location.description ?? i.location.landmark ?? "—"}</td>
                  <td>{holder ? holder.holder : t("professional:noResponder", { defaultValue: "No responder assigned" })}</td>
                  <td>
                    {handoff === "none"
                      ? t("professional:ccHandoffNone", { defaultValue: "None" })
                      : handoff === "pending"
                        ? t("professional:ccHandoffPending", { defaultValue: "Pending" })
                        : t("professional:ccHandoffComplete", { defaultValue: "Complete" })}
                  </td>
                  <td>{relativeTime(i.updatedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      incident={i}
                      view={view}
                      onPin={() => actions.onPin(i)}
                      onArchive={() => actions.onArchive(i)}
                      onTrash={() => actions.onTrash(i)}
                      onUnarchive={() => actions.onUnarchive(i)}
                      onRestore={() => actions.onRestore(i)}
                      onDeleteForever={() => actions.onDeleteForever(i)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Fast right-side case inspector — opens in place, Escape closes,
 *  focus moves in on open and returns to the trigger on close. */
function InspectorPanel({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const last = lastUpdateOf(incident);
  const holder = currentHolder(incident);
  const handoff = handoffStateOf(incident);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => { previous?.focus?.(); };
  }, []);

  const fieldLabel: CSSProperties = { margin: 0, fontSize: "0.78rem", color: "var(--c-ink-faint)", textTransform: "uppercase", letterSpacing: "0.04em" };
  const fieldValue: CSSProperties = { margin: "2px 0 0", fontSize: "0.92rem" };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="card"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(380px, 92vw)",
        zIndex: 300,
        borderRadius: 0,
        overflowY: "auto",
        padding: "var(--space-4)",
        margin: 0,
      }}
    >
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: "1rem" }}>
          {t("professional:ccInspectorTitle", { defaultValue: "Case inspector" })}
        </h2>
        <button className="btn btn-quiet btn-sm" aria-label={t("professional:ccClose", { defaultValue: "Close" })} onClick={onClose}>
          <Icons.x size={16} />
        </button>
      </div>
      <p style={{ margin: "var(--space-3) 0 4px", fontSize: "1.05rem", fontWeight: 700 }}><bdi>{incident.humanReference}</bdi></p>
      <StatusBadge status={incident.status} />

      <div className="stack" style={{ marginTop: "var(--space-4)", gap: "var(--space-3)" }}>
        <div>
          <p style={fieldLabel}>{t("professional:ccColAnimal", { defaultValue: "Animal" })}</p>
          <p style={fieldValue}>{animalLabel(incident)}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t("professional:ccFieldLocation", { defaultValue: "Location" })}</p>
          <p style={fieldValue}>{incident.location.description ?? incident.location.landmark ?? t("professional:ccNoLocation", { defaultValue: "No location recorded" })}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t("professional:ccFieldCustody", { defaultValue: "Current custody" })}</p>
          <p style={fieldValue}>
            {holder
              ? `${holder.holder}${holder.holderRole ? ` (${holder.holderRole})` : ""}`
              : t("professional:noResponder", { defaultValue: "No responder assigned" })}
          </p>
        </div>
        <div>
          <p style={fieldLabel}>{t("professional:ccFieldAge", { defaultValue: "Age" })}</p>
          <p style={fieldValue}>{relativeTime(incident.occurredAt ?? incident.createdAt)} · {formatDateTime(incident.occurredAt ?? incident.createdAt)}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t("professional:ccFieldLatestUpdate", { defaultValue: "Latest update" })}</p>
          <p style={fieldValue}>{last ? `${last.summary} · ${relativeTime(last.timestamp)}` : "—"}</p>
        </div>
        <div>
          <p style={fieldLabel}>{t("professional:ccFieldHandoff", { defaultValue: "Handoff" })}</p>
          <p style={fieldValue}>
            {handoff === "none"
              ? t("professional:ccHandoffNone", { defaultValue: "None" })
              : handoff === "pending"
                ? t("professional:ccHandoffPending", { defaultValue: "Pending" })
                : t("professional:ccHandoffComplete", { defaultValue: "Complete" })}
          </p>
        </div>
      </div>

      <div className="row" style={{ marginTop: "var(--space-4)", gap: 8 }}>
        <button className="btn btn-primary" onClick={() => navigate(`/incidents/${incident.id}`)}>
          {t("professional:ccOpenFull", { defaultValue: "Open full incident" })}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>
          {t("professional:ccClose", { defaultValue: "Close" })}
        </button>
      </div>
    </div>
  );
}

/** Compact report card: body opens the case inspector; ⋯ menu for secondary
 *  actions; status in the footer. Compact density shows two structured rows. */
function ReportCard({
  incident, view, density, onOpen, onPin, onArchive, onTrash, onUnarchive, onRestore, onDeleteForever,
}: {
  incident: Incident;
  view: View;
  density: Density;
  onOpen: () => void;
  onPin: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onUnarchive: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const { t } = useTranslation();
  const last = lastUpdateOf(incident);

  return (
    <div
      className="report-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement) === e.currentTarget) onOpen(); }}
      aria-label={`${animalLabel(incident)} — ${t(incident.status, { ns: "status" })}`}
    >
      <div className="rc-top">
        <div className="rc-title-row">
          <p className="ic-title">{animalLabel(incident)}</p>
          <span className="badge" data-status={incident.status}>{t(incident.status, { ns: "status" })}</span>
        </div>
        <RowActionsMenu
          incident={incident}
          view={view}
          onPin={onPin}
          onArchive={onArchive}
          onTrash={onTrash}
          onUnarchive={onUnarchive}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      </div>
      {density === "compact" ? (
        // Two structured rows: identity (ref · age · location) and custody state.
        <>
          <p className="ic-meta">
            <bdi>{incident.humanReference}</bdi> · {relativeTime(incident.occurredAt ?? incident.createdAt)}
            {incident.location.description ? ` · ${incident.location.description}` : ""}
          </p>
          <p className="ic-meta">
            {incident.custody.some((c) => !c.endedAt)
              ? `${t("professional:ccFieldCustody", { defaultValue: "Current custody" })}: ${currentHolder(incident)?.holder ?? "—"}`
              : t("professional:noResponder", { defaultValue: "No responder assigned" })}
          </p>
        </>
      ) : (
        <>
          <p className="ic-meta">
            {incident.humanReference} · {formatDateTime(incident.occurredAt ?? incident.createdAt)}
            {incident.location.description ? ` · ${incident.location.description}` : ""}
          </p>
          {last && <p className="ic-updates">{t("reports:lastUpdatePrefix")} {last.summary} · {relativeTime(last.timestamp)}</p>}
          <div className="rc-footer">
            <span style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>
              {incident.custody.some((c) => !c.endedAt) ? "" : t("professional:noResponder")}
            </span>
            <span style={{ marginLeft: "auto", color: "var(--c-ink-faint)", display: "inline-flex", paddingRight: 4 }} aria-hidden="true">
              <Icons.chevronRight size={18} />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
