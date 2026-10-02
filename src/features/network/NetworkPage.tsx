/**
 * Professional operations dashboard — "Local Professional Preview" command
 * center (0.2.0-dev.7 overhaul).
 *
 * Layered operational console over LOCAL incident data only:
 * Needs Attention queue → KPI strip → map fusion + live activity →
 * response performance + aging → modern trend chart → distributions →
 * handoff + workload analytics. Unified filters affect every widget.
 * No fake network data; the network registry stays explicitly fictional.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { useTranslation } from "react-i18next";
import { useIncidents } from "../incidents/IncidentCard";
import { Icons } from "../../components/Icons";
import { EmptyState, StatusBadge, TextField } from "../../components/ui";
import { Select } from "../../components/Select";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";
import {
  FEED_GROUPS, LOCAL_ORG_REGISTRY, distanceFromArea, feedGroupFor,
  findDuplicateCandidates, inServiceArea, type ServiceArea,
} from "./networkService";
import { formatDistance } from "../../utils/units";
const NetworkMap = lazy(() => import("./NetworkMap").then((m) => ({ default: m.NetworkMap })));
import { getSetting, setSetting } from "../../storage/repositories";
import { changeStatus } from "../../storage/incidentService";
import * as analytics from "./incidentAnalytics";
import { TrendChart } from "./TrendChart";
import { AnimatedNumber } from "./dashboard/AnimatedNumber";
import { AgingStrip, BarDistribution } from "./dashboard/opsCharts";
import { getAuthorizationState } from "./authorization";
import type { Incident } from "../../types/incident";

type TimeRangeFilter = "all" | "today" | "7d" | "30d";
type AssignedFilter = "any" | "assigned" | "unassigned";

interface DashboardFilters {
  status: string;
  animalGroup: string;
  incidentType: string;
  assigned: AssignedFilter;
  time: TimeRangeFilter;
}

const EMPTY_FILTERS: DashboardFilters = { status: "", animalGroup: "", incidentType: "", assigned: "any", time: "all" };

export function NetworkPage() {
  const { incidents, refresh } = useIncidents();
  const { settings, showToast } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation("professional");
  const [tab, setTab] = useState<"list" | "map">("list");
  const [opsView, setOpsView] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [area, setArea] = useState<ServiceArea>({ centerLat: null, centerLon: null, radiusKm: 25, label: "My service area" });
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<1 | 7 | 30 | 90>(7);
  const [now, setNow] = useState(() => new Date());
  const org = LOCAL_ORG_REGISTRY[0];
  const firstName = (settings.professionalProfile?.name || settings.displayName || "").trim().split(/\s+/)[0];
  const isVerified = getAuthorizationState().status === "verified";

  useEffect(() => {
    getSetting<ServiceArea>("network-service-area").then((saved) => {
      if (saved) setArea(saved);
      setLoaded(true);
    });
  }, []);

  // "Updated just now" honesty: re-stamp the clock on a slow tick.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Operations View (Y): hide app chrome. Deliberate, reversible, never forced.
  useEffect(() => {
    document.documentElement.classList.toggle("ops-view", opsView);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && opsView) setOpsView(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("ops-view");
      window.removeEventListener("keydown", onKey);
    };
  }, [opsView]);

  const saveArea = (next: ServiceArea) => {
    setArea(next);
    void setSetting("network-service-area", next);
  };

  const live = useMemo(() => (incidents ?? []).filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo), [incidents]);

  // Unified dashboard filtering (W): applied consistently to every widget.
  const filtered = useMemo(() => {
    const nowTime = Date.now();
    let list = live;
    if (filters.time === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      list = list.filter((i) => new Date(i.occurredAt ?? i.createdAt).getTime() >= start.getTime());
    } else if (filters.time === "7d") {
      list = list.filter((i) => nowTime - new Date(i.occurredAt ?? i.createdAt).getTime() <= 7 * 86400_000);
    } else if (filters.time === "30d") {
      list = list.filter((i) => nowTime - new Date(i.occurredAt ?? i.createdAt).getTime() <= 30 * 86400_000);
    }
    if (filters.status) list = list.filter((i) => i.status === filters.status);
    if (filters.animalGroup) list = list.filter((i) => (i.animal.group ?? "unknown") === filters.animalGroup);
    if (filters.incidentType) list = list.filter((i) => i.incidentType === filters.incidentType);
    if (filters.assigned !== "any") {
      const hasResponder = (i: Incident) => i.custody.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested";
      list = list.filter((i) => (filters.assigned === "assigned") === hasResponder(i));
    }
    return list;
  }, [live, filters]);

  const inArea = useMemo(() => filtered.filter((i) => inServiceArea(i, area)), [filtered, area]);
  const duplicates = useMemo(() => findDuplicateCandidates(live), [live]);
  const grouped = useMemo(() => {
    const map: Record<string, typeof inArea> = { new: [], active: [], transfer: [], closed: [] };
    for (const i of inArea) map[feedGroupFor(i)]!.push(i);
    for (const key of Object.keys(map)) {
      map[key]!.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return map;
  }, [inArea]);
  const dupIds = useMemo(() => new Set(duplicates.flatMap((d) => [d.a.id, d.b.id])), [duplicates]);

  const kpis = useMemo(() => analytics.getOpenCounts(filtered), [filtered]);
  const metrics = useMemo(() => analytics.getResponseTimeMetrics(filtered, now), [filtered, now]);
  const aging = useMemo(() => analytics.getAgingBuckets(filtered, now), [filtered, now]);
  const statusDist = useMemo(() => analytics.getStatusDistribution(filtered), [filtered]);
  const animalDist = useMemo(() => analytics.getAnimalDistribution(filtered), [filtered]);
  const typeDist = useMemo(() => analytics.getIncidentTypeDistribution(filtered), [filtered]);
  const transfer = useMemo(() => analytics.getTransferMetrics(filtered), [filtered]);
  const workload = useMemo(() => analytics.getResponderWorkload(filtered), [filtered]);
  const feed = useMemo(() => analytics.getActivityFeed(filtered), [filtered]);
  const series = useMemo(() => analytics.getTimeSeries(filtered, range), [filtered, range]);
  const attention = useMemo(() => analytics.getNeedsAttention(filtered, now), [filtered, now]);

  const animalUnknownCount = filtered.filter((i) => !i.animal.group).length;
  const animalUnknownDominant = filtered.length >= 4 && animalUnknownCount / filtered.length > 0.5;

  const attentionCards = useMemo(() => {
    const cards: Array<{ key: string; icon: JSX.Element; count: number; reason: string; severity: "alert" | "warn" | "info"; action: string; to: string; time?: string }> = [];
    if (kpis.unassigned > 0) {
      cards.push({
        key: "unassigned", icon: <Icons.user size={16} />, count: kpis.unassigned,
        reason: t("attnUnassigned", { defaultValue: "Unassigned reports" }), severity: "warn",
        action: t("attnReview", { defaultValue: "Review" }), to: "/incidents?category=awaiting",
      });
    }
    if (attention.unassignedOld.length > 0) {
      const oldest = attention.unassignedOld[0]!;
      cards.push({
        key: "waiting", icon: <Icons.clock size={16} />, count: attention.unassignedOld.length,
        reason: t("attnWaitingOver2h", { defaultValue: "Waiting more than 2 hours" }), severity: "alert",
        action: t("attnReview", { defaultValue: "Review" }),
        to: "/incidents?category=awaiting", time: relativeTime(oldest.occurredAt ?? oldest.createdAt),
      });
    }
    if (attention.handoffWaiting.length > 0) {
      cards.push({
        key: "handoff", icon: <Icons.handoff size={16} />, count: attention.handoffWaiting.length,
        reason: t("attnHandoffWaiting", { defaultValue: "Handoff awaiting acceptance" }), severity: "warn",
        action: t("attnReview", { defaultValue: "Review" }), to: "/incidents?category=active",
      });
    }
    if (attention.missingLocation.length > 0) {
      cards.push({
        key: "location", icon: <Icons.map size={16} />, count: attention.missingLocation.length,
        reason: t("attnMissingLocation", { defaultValue: "Missing usable location" }), severity: "info",
        action: t("attnFix", { defaultValue: "Fix" }), to: "/incidents?category=active",
      });
    }
    if (attention.possibleDuplicates.length > 0) {
      cards.push({
        key: "dupes", icon: <Icons.flag size={16} />, count: attention.possibleDuplicates.length,
        reason: t("attnDuplicates", { defaultValue: "Possible duplicate" }), severity: "info",
        action: t("attnReview", { defaultValue: "Review" }), to: "/incidents",
      });
    }
    return cards;
  }, [kpis, attention, t]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("filterAnyStatus", { defaultValue: "Any status" }) },
    ...Array.from(new Set(live.map((i) => i.status))).map((s) => ({ value: s as string, label: s as string })),
  ], [live, t]);
  const animalOptions = useMemo(() => [
    { value: "", label: t("filterAnyAnimal", { defaultValue: "Any animal group" }) },
    ...Array.from(new Set(live.map((i) => i.animal.group ?? "unknown"))).map((g) => ({ value: g, label: g })),
  ], [live, t]);
  const typeOptions = useMemo(() => [
    { value: "", label: t("filterAnyType", { defaultValue: "Any incident type" }) },
    ...Array.from(new Set(live.map((i) => i.incidentType).filter((v): v is Exclude<Incident["incidentType"], null> => v != null))).map((v) => ({ value: v as string, label: v as string })),
  ], [live, t]);

  if (!loaded) return <main className="content" id="main-content" />;

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <main className="content wide" id="main-content">
      {/* ---- Top bar (J) ---- */}
      <div className="ops-topbar fade-in">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>
            {firstName
              ? t("opsGreeting", {
                  defaultValue: "Good day, {{name}}",
                  name: firstName,
                  interpolation: { escapeValue: false },
                  context: daypart(),
                })
              : t("opsLiveTitle", { defaultValue: "Live local operations" })}
          </h1>
          <p style={{ margin: "2px 0 0", color: "var(--c-ink-faint)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {settings.professionalProfile?.organization && <strong>{settings.professionalProfile.organization}</strong>}
            <span className="ops-live-dot" aria-hidden="true" />
            <span>{t("opsLiveTitle", { defaultValue: "Live local operations" })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("opsUpdatedNow", { defaultValue: "Updated" })} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span aria-hidden="true">·</span>
            <span className="badge" data-status="response_requested">
              {isVerified ? t("networkConnected", { defaultValue: "Connected" }) : t("networkLocalPreview", { defaultValue: "Network: local professional preview" })}
            </span>
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
            <Icons.filter size={14} /> {t("filters", { defaultValue: "Filters" })}{filtersActive ? " •" : ""}
          </button>
          <div className="segmented" role="group" aria-label="Dashboard view">
            <button aria-pressed={tab === "list"} onClick={() => setTab("list")}>{t("list")}</button>
            <button aria-pressed={tab === "map"} onClick={() => setTab("map")}>{t("map")}</button>
          </div>
          <button className="btn btn-ghost btn-sm" aria-pressed={opsView} onClick={() => setOpsView((v) => !v)} title="Esc exits">
            <Icons.monitor size={14} /> {t("opsView", { defaultValue: "Operations view" })}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="card ops-filters fade-in" role="group" aria-label={t("filters", { defaultValue: "Filters" })}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select label={t("filterStatus", { defaultValue: "Status" })} value={filters.status} options={statusOptions} onChange={(v) => setFilters({ ...filters, status: v })} optional />
            <Select label={t("filterAnimal", { defaultValue: "Animal group" })} value={filters.animalGroup} options={animalOptions} onChange={(v) => setFilters({ ...filters, animalGroup: v })} optional />
            <Select label={t("filterType", { defaultValue: "Incident type" })} value={filters.incidentType} options={typeOptions} onChange={(v) => setFilters({ ...filters, incidentType: v })} optional />
            <Select
              label={t("filterAssigned", { defaultValue: "Assignment" })}
              value={filters.assigned}
              options={[
                { value: "any", label: t("filterAnyAssigned", { defaultValue: "Any" }) },
                { value: "assigned", label: t("filterAssignedOnly", { defaultValue: "Assigned" }) },
                { value: "unassigned", label: t("filterUnassignedOnly", { defaultValue: "Unassigned" }) },
              ]}
              onChange={(v) => setFilters({ ...filters, assigned: v as AssignedFilter })}
              optional
            />
            <Select
              label={t("filterTime", { defaultValue: "Time range" })}
              value={filters.time}
              options={[
                { value: "all", label: t("filterTimeAll", { defaultValue: "All time" }) },
                { value: "today", label: t("filterTimeToday", { defaultValue: "Today" }) },
                { value: "7d", label: t("filterTime7d", { defaultValue: "Last 7 days" }) },
                { value: "30d", label: t("filterTime30d", { defaultValue: "Last 30 days" }) },
              ]}
              onChange={(v) => setFilters({ ...filters, time: v as TimeRangeFilter })}
              optional
            />
            {filtersActive && (
              <button className="btn btn-quiet btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>{t("clearFilters", { defaultValue: "Clear filters" })}</button>
            )}
          </div>
          <p className="hint" style={{ margin: 0 }}>{t("filtersApplyAll", { defaultValue: "Filters apply to every dashboard widget below." })}</p>
        </div>
      )}

      {live.length === 0 ? (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <EmptyState
            icon={<Icons.handoff size={40} />}
            title={t("emptyTitle", { defaultValue: "No incident data yet" })}
            hint={t("emptyHint", { defaultValue: "Analytics appear here as soon as real incidents exist on this device." })}
            action={<Link className="btn btn-secondary" to="/examples">{t("openDemo", { defaultValue: "Open fictional dashboard demo" })}</Link>}
          />
        </div>
      ) : (
        <>
          {/* ---- Needs attention (K) — FIRST major section ---- */}
          {attentionCards.length > 0 && (
            <section aria-labelledby="attn-title" style={{ marginTop: "var(--space-4)" }}>
              <h2 id="attn-title" className="section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="ops-live-dot" aria-hidden="true" />
                {t("needsAttention", { defaultValue: "Needs attention" })}
              </h2>
              <div className="attn-grid">
                {attentionCards.map((c) => (
                  <button key={c.key} className={`attn-card severity-${c.severity}`} onClick={() => navigate(c.to)}>
                    <span className="attn-icon" aria-hidden="true">{c.icon}</span>
                    <span className="attn-count"><AnimatedNumber value={c.count} /></span>
                    <span className="attn-reason">{c.reason}</span>
                    {c.time && <span className="attn-time">{t("attnOldest", { defaultValue: "Oldest: {{time}}", time: c.time })}</span>}
                    <span className="attn-action">{c.action} <Icons.chevronRight size={12} /></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ---- KPI strip (L) ---- */}
          <div className="kpi-row kpi-strip" style={{ marginTop: "var(--space-4)" }}>
            <KpiCard label={t("kpiNewReports", { defaultValue: "New reports" })} value={kpis.newReports} accent />
            <KpiCard label={t("kpiUnassigned", { defaultValue: "Unassigned" })} value={kpis.unassigned} />
            <KpiCard label={t("kpiActiveResponse", { defaultValue: "Active response" })} value={kpis.responderAssigned + kpis.inResponse} />
            <KpiCard label={t("kpiAwaitingHandoff", { defaultValue: "Awaiting handoff" })} value={kpis.awaitingTransfer} />
            <KpiCard label={t("kpiOpenTotal", { defaultValue: "Open total" })} value={kpis.openTotal} />
            <KpiCard label={t("kpiResolvedToday", { defaultValue: "Resolved today" })} value={metrics.resolvedToday} />
          </div>

          {/* ---- Map fusion (M) + live activity (N) ---- */}
          <div className="ops-grid ops-grid-map" style={{ marginTop: "var(--space-4)" }}>
            <div className="card ops-panel">
              <div className="row between">
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icons.map size={16} /> {t("mapTitle", { defaultValue: "Geographic operations" })}
                </h3>
                <Link to="/network" className="btn btn-ghost btn-sm" onClick={() => setTab("map")}>{t("openFullMap", { defaultValue: "Open full map" })}</Link>
              </div>
              <div style={{ marginTop: "var(--space-3)", minHeight: 240 }}>
                {settings.mapTilesEnabled === false ? (
                  <p className="hint">{t("mapDisabled", { defaultValue: "Online maps are off (Settings → Map). Showing local incident positions instead:" })}{" "}
                    <ul style={{ paddingLeft: 18 }}>
                      {inArea.slice(0, 6).map((i) => (
                        <li key={i.id}>
                          <Link to={`/incidents/${i.id}`}>{i.humanReference}</Link> — {i.location.description || animalLabel(i)}
                        </li>
                      ))}
                    </ul>
                  </p>
                ) : (
                  <Suspense fallback={<p style={{ color: "var(--c-ink-faint)" }}>…</p>}>
                    <NetworkMap
                      incidents={inArea}
                      privacy="approximate"
                      compact
                      onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
                    />
                  </Suspense>
                )}
              </div>
            </div>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.activity size={16} /> {t("liveActivity", { defaultValue: "Live activity" })}
              </h3>
              {feed.length === 0 ? (
                <p className="hint">{t("feedEmpty", { defaultValue: "Timeline events from your records will appear here." })}</p>
              ) : (
                <ol className="ops-feed" aria-label={t("liveActivity", { defaultValue: "Live activity" })}>
                  {feed.slice(0, 8).map((e, idx) => (
                    <li key={`${e.incidentId}-${idx}`}>
                      <button onClick={() => navigate(`/incidents/${e.incidentId}`)} className="ops-feed-item">
                        <span className="ops-feed-time">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="ops-feed-body">
                          <span className="ops-feed-event">{e.summary}</span>
                          <span className="ops-feed-ref">{e.incidentRef}{e.animalLabel ? ` · ${e.animalLabel}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* ---- Performance (O) + aging (P) ---- */}
          <div className="ops-grid ops-grid-2" style={{ marginTop: "var(--space-4)" }}>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.zap size={16} /> {t("performance", { defaultValue: "Response performance" })}
              </h3>
              {metrics.sufficientData ? (
                <dl className="kv">
                  {metrics.medianHoursToAssignment != null && (<><dt>{t("perfAssign", { defaultValue: "Median time to assignment" })}</dt><dd>{formatH(metrics.medianHoursToAssignment)}</dd></>)}
                  {metrics.medianHoursToPickup != null && (<><dt>{t("perfPickup", { defaultValue: "Median time to pickup" })}</dt><dd>{formatH(metrics.medianHoursToPickup)}</dd></>)}
                  {metrics.medianHoursToTransfer != null && (<><dt>{t("perfTransfer", { defaultValue: "Median time to transfer" })}</dt><dd>{formatH(metrics.medianHoursToTransfer)}</dd></>)}
                  {metrics.oldestUnassignedHours != null && (<><dt>{t("perfOldest", { defaultValue: "Oldest unassigned" })}</dt><dd>{formatH(metrics.oldestUnassignedHours)}</dd></>)}
                  <dt>{t("perfOpenedToday", { defaultValue: "Opened today" })}</dt><dd>{metrics.openedToday}</dd>
                  <dt>{t("perfResolvedToday", { defaultValue: "Resolved today" })}</dt><dd>{metrics.resolvedToday}</dd>
                </dl>
              ) : (
                <p style={{ color: "var(--c-ink-faint)" }}>{t("notEnoughData", { defaultValue: "Not enough data yet" })}</p>
              )}
            </div>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.clock size={16} /> {t("caseAging", { defaultValue: "Case aging" })}
              </h3>
              <div style={{ marginTop: "var(--space-3)" }}>
                <AgingStrip buckets={aging} onPick={() => navigate("/incidents?category=active")} />
              </div>
              <h3 style={{ marginTop: "var(--space-4)" }}>{t("transfers", { defaultValue: "Transfers" })}</h3>
              <dl className="kv">
                <dt>{t("transferAwaiting", { defaultValue: "Awaiting transfer" })}</dt><dd>{transfer.awaitingTransfer}</dd>
                <dt>{t("transferToday", { defaultValue: "Transferred today" })}</dt><dd>{transfer.transferredToday}</dd>
                {transfer.medianWaitHours != null && (<><dt>{t("transferMedianWait", { defaultValue: "Median wait" })}</dt><dd>{formatH(transfer.medianWaitHours)}</dd></>)}
                <dt>{t("transferOrgs", { defaultValue: "Receiving organizations" })}</dt><dd>{transfer.receivingOrganizations.length === 0 ? "—" : transfer.receivingOrganizations.join(", ")}</dd>
              </dl>
            </div>
          </div>

          {/* ---- Reports over time (Q) ---- */}
          <div className="card ops-panel" style={{ marginTop: "var(--space-4)" }}>
            <div className="row between">
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.activity size={16} /> {t("reportsOverTime", { defaultValue: "Reports over time" })}
              </h3>
              <div className="segmented" role="group" aria-label="Time range">
                {([1, 7, 30, 90] as const).map((d) => (
                  <button key={d} aria-pressed={range === d} onClick={() => setRange(d)}>{d === 1 ? "24 hours" : `${d} days`}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <TrendChart points={series} />
            </div>
          </div>

          {/* ---- Distributions (R, S, T) ---- */}
          <div className="ops-grid ops-grid-3" style={{ marginTop: "var(--space-4)" }}>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0 }}>{t("openByStatus", { defaultValue: "Open by status" })}</h3>
              <BarDistribution entries={statusDist} onPick={() => navigate("/incidents?category=active")} />
            </div>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0 }}>{t("animalGroups", { defaultValue: "Animal groups" })}</h3>
              <BarDistribution
                entries={animalDist}
                onPick={() => navigate("/incidents")}
                note={animalUnknownDominant ? t("animalQualityNote", { defaultValue: "Animal group is missing for most reports." }) : null}
              />
              {animalUnknownDominant && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate("/incidents?category=active")}>
                  {t("reviewReports", { defaultValue: "Review reports" })}
                </button>
              )}
            </div>
            <div className="card ops-panel">
              <h3 style={{ marginTop: 0 }}>{t("incidentTypes", { defaultValue: "Incident types" })}</h3>
              <BarDistribution entries={typeDist} onPick={() => navigate("/incidents")} />
              <p style={{ color: "var(--c-ink-faint)", fontSize: "0.78rem", margin: "var(--space-2) 0 0" }}>
                {t("typeNote", { defaultValue: "Categories reflect what reporters selected — no cause is implied beyond the record." })}
              </p>
            </div>
          </div>

          {/* ---- Workload (V) ---- */}
          {workload.length > 0 && (
            <div className="card ops-panel" style={{ marginTop: "var(--space-4)" }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.users size={16} /> {t("workload", { defaultValue: "Responder workload" })}
              </h3>
              <p className="hint" style={{ marginBottom: 8 }}>{t("workloadNote", { defaultValue: "Operational capacity visibility — no rankings or productivity scoring." })}</p>
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("wlResponder", { defaultValue: "Responder" })}</th>
                      <th scope="col">{t("wlAssigned", { defaultValue: "Assigned cases" })}</th>
                      <th scope="col">{t("wlActive", { defaultValue: "Active cases" })}</th>
                      <th scope="col">{t("wlCompletedToday", { defaultValue: "Completed today" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map((w) => (
                      <tr key={w.actor}>
                        <td>{w.actor}</td>
                        <td>{w.assignedCases}</td>
                        <td>{w.activeCases}</td>
                        <td>{w.completedToday}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="hint" style={{ marginTop: "var(--space-3)" }}>
            {t("updatedLine", { defaultValue: "Live from this device's local data store" })} ({now.toLocaleTimeString()})
          </p>
        </>
      )}

      {tab === "map" ? (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <h3 style={{ marginTop: 0 }}>{t("mapTitle")}</h3>
          <Suspense fallback={<p style={{ color: "var(--c-ink-faint)" }}>Loading map…</p>}>
            <NetworkMap
              incidents={inArea}
              privacy="approximate"
              onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
            />
          </Suspense>
        </div>
      ) : (
        <>
          {duplicates.length > 0 && (
            <div className="notice warning" style={{ marginTop: "var(--space-4)" }}>
              <Icons.warning size={18} />
              <div>
                <strong>Possible duplicate report{duplicates.length === 1 ? "" : "s"}</strong> — these incidents look
                similar by location, time and description. Nothing is merged automatically; review them:
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {duplicates.map((d, idx) => (
                    <li key={idx}>
                      <Link to={`/incidents/${d.a.id}`}>{d.a.humanReference}</Link> and{" "}
                      <Link to={`/incidents/${d.b.id}`}>{d.b.humanReference}</Link>
                      {d.distanceKm != null && <> — {formatDistance(d.distanceKm, settings.units)} apart, ~{Math.round(d.ageHours)}h</>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {FEED_GROUPS.map((group) => (
            <section key={group.id} style={{ marginTop: "var(--space-5)" }}>
              <h2 className="section-label">{t(group.id === "new" ? "newGroup" : group.id)} ({grouped[group.id]!.length})</h2>
              {grouped[group.id]!.length === 0 ? (
                <p style={{ color: "var(--c-ink-faint)", fontSize: "0.88rem" }}>{t("nothingHere")}</p>
              ) : (
                <div className="card-list">
                  {grouped[group.id]!.map((i) => {
                    const dist = distanceFromArea(i, area);
                    return (
                      <div key={i.id} className="incident-card" style={{ flexWrap: "wrap" }}>
                        <div className="ic-body">
                          <div className="row between" style={{ gap: 8 }}>
                            <p className="ic-title">
                              {animalLabel(i)}
                              {dupIds.has(i.id) && (
                                <span className="badge warn" style={{ marginLeft: 8 }} title="Possible duplicate report">possible duplicate</span>
                              )}
                            </p>
                            <StatusBadge status={i.status} />
                          </div>
                          <p className="ic-meta">
                            {i.humanReference} · Reported {relativeTime(i.occurredAt ?? i.createdAt)}
                            {dist != null && <> · {formatDistance(dist, settings.units)} away</>}
                            {i.hazards && i.hazards.hazards.length > 0 && <> · {i.hazards.hazards.length} hazard{i.hazards.hazards.length === 1 ? "" : "s"}</>}
                            {i.custody.some((c) => !c.endedAt) && i.status !== "reported" ? "" : " · No responder assigned"}
                          </p>
                          {i.location.description && <p className="ic-meta">{i.location.description}</p>}
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          {group.id === "new" && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={async () => {
                                await changeStatus(i, "responder_assigned", settings.displayName || null, `Accepted by ${org?.name ?? "local organization"}`);
                                showToast(t("acceptedToast", { defaultValue: "Incident accepted — responder assigned" }));
                                await refresh();
                              }}
                            >
                              {t("accept")}
                            </button>
                          )}
                          <Link className="btn btn-secondary btn-sm" to={`/incidents/${i.id}`}>{t("review")}</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {inArea.length === 0 && (
            <div className="card" style={{ marginTop: "var(--space-4)" }}>
              <EmptyState
                icon={<Icons.handoff size={40} />}
                title={t("emptyAreaTitle", { defaultValue: "No incidents in your service area yet" })}
                hint={t("emptyAreaHint", { defaultValue: "When incidents with coordinates inside your radius exist on this device, they appear here grouped by response stage." })}
              />
            </div>
          )}

          <details className="card" style={{ marginTop: "var(--space-4)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("serviceArea")}</summary>
            <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>{t("serviceAreaNote")}</p>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <TextField label="Center latitude" type="number" step="any" value={area.centerLat?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLat: v ? parseFloat(v) : null })} optional />
              <TextField label="Center longitude" type="number" step="any" value={area.centerLon?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLon: v ? parseFloat(v) : null })} optional />
              <TextField label="Radius (km)" type="number" value={area.radiusKm.toString()} onChange={(v) => saveArea({ ...area, radiusKm: Math.max(1, parseFloat(v) || 25) })} />
            </div>
          </details>
        </>
      )}
    </main>
  );
}

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`kpi-card${accent ? " kpi-accent" : ""}`}>
      <AnimatedNumber value={value} />
      <span className="kpi-label">{label}</span>
    </div>
  );
}

function formatH(hours: number): string {
  if (hours < 1) return Math.round(hours * 60) + " min";
  if (hours < 48) return Math.round(hours) + " h";
  return Math.round(hours / 24) + " days";
}
