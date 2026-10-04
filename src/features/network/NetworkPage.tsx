/**
 * Professional operations dashboard — "Local Professional Preview" (dev.8).
 *
 * 12-column responsive operations grid: service-area map as primary context,
 * Needs Attention queue, live activity, operational pulse (KPI tiles with
 * honest deltas), response-flow pipeline, performance + aging, modern trend
 * chart, distributions, handoff + workload analytics. Unified filters apply
 * to every widget; widgets emphasize by active professional role (preview
 * roles tailor presentation only — they never authorize anything).
 */
import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { useTranslation } from "react-i18next";
import { useIncidents } from "../incidents/IncidentCard";
import { Icons } from "../../components/Icons";
import { EmptyState, StatusBadge, TextField } from "../../components/ui";
import { Dialog } from "../../components/Dialog";
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
import { putIncident } from "../../storage/repositories";
import * as analytics from "./incidentAnalytics";
import { TrendChart } from "./TrendChart";
import { AnimatedNumber } from "./dashboard/AnimatedNumber";
import { AgingStrip, BarDistribution } from "./dashboard/opsCharts";
import { IncidentQueueRow } from "./dashboard/IncidentQueueRow";
import { ResponseFlow } from "./dashboard/ResponseFlow";
import { computeIntegrityReview } from "../integrity/integrityService";
import { getAuthorizationState } from "./authorization";
import { countryDateLocale, countryMapViewport } from "../country/countryProfile";
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

// ---- Dashboard customization (P80) -----------------------------------------
// Widgets are individually show/hide-able and reorderable; the layout is
// persisted locally. "Needs attention" can be hidden but never silently —
// a confirmation explains what is being turned off. The map is the primary
// operational context and cannot be hidden.

type WidgetId =
  | "map" | "attention" | "activity" | "kpis" | "pipeline" | "performance"
  | "aging" | "trend" | "statusDist" | "animalDist" | "typeDist" | "workload"
  | "integrity";

const DASHBOARD_LAYOUT_KEY = "network-dashboard-layout";

interface DashboardLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

export function NetworkPage() {
  const { incidents, refresh } = useIncidents();
  const { settings, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation("professional");
  // Map is a first-class destination: /network?view=map (sidebar "Map").
  // The URL is the single source of truth — no mirrored state, so sidebar
  // navigation to ?view=map always wins (regression: clicking Map from
  // Response Network did nothing because a sync effect wrote the old tab
  // state back over the new URL).
  const tab: "list" | "map" = searchParams.get("view") === "map" ? "map" : "list";
  const setTab = (next: "list" | "map") => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "map") nextParams.set("view", "map"); else nextParams.delete("view");
    setSearchParams(nextParams, { replace: true });
  };
  const [opsView, setOpsView] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [density, setDensity] = useState<"cards" | "table">("cards");
  const [area, setArea] = useState<ServiceArea>({ centerLat: null, centerLon: null, radiusKm: 25, label: "My service area" });
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<1 | 7 | 30 | 90>(7);
  const [now, setNow] = useState(() => new Date());
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [testView, setTestView] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmHideAttention, setConfirmHideAttention] = useState(false);
  const org = LOCAL_ORG_REGISTRY[0];
  const firstName = (settings.professionalProfile?.name || settings.displayName || "").trim().split(/\s+/)[0];
  const isVerified = getAuthorizationState().status === "verified";
  const activeRole = settings.professionalRoles?.find((r) => r.role === settings.activeProfessionalRole) ?? settings.professionalRoles?.[0];

  useEffect(() => {
    getSetting<ServiceArea>("network-service-area").then((saved) => {
      if (saved) setArea(saved);
      else {
        // Country default viewport ONLY when no service area exists (spec 65).
        const vp = countryMapViewport(settings.country);
        if (vp) setArea((a) => (a.centerLat == null ? { ...a, centerLat: vp.lat, centerLon: vp.lon } : a));
      }
      setLoaded(true);
    });
    getSetting<DashboardLayout>(DASHBOARD_LAYOUT_KEY).then((saved) => {
      if (saved && Array.isArray(saved.order) && Array.isArray(saved.hidden)) setLayout(saved);
    });
    getSetting<boolean>("network-test-view").then((v) => {
      if (v === true) setTestView(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Updated X ago" honesty: re-stamp the clock on a slow tick.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Operations View (P57): hide app chrome. Deliberate, reversible, never forced.
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

  // Test view (dev.14): fictional demo incidents join the dashboard for
  // rehearsal/training. Presentation only — real records are never modified.
  const live = useMemo(
    () => (incidents ?? []).filter((i) => !i.deletedAt && !i.archivedAt && (testView || !i.isDemo)).map((i) => (testView ? { ...i, isDemo: false } : i)),
    [incidents, testView]
  );

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
  // Report integrity review (0.3): heuristic review hints — professionals decide.
  const integrityReview = useMemo(() => computeIntegrityReview(filtered, { duplicatePairs: duplicates }), [filtered, duplicates]);

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
  const rangeDays = filters.time === "today" ? 1 : filters.time === "7d" ? 7 : filters.time === "30d" ? 30 : 30;
  const newWithDelta = useMemo(() => analytics.getCountWithDelta(filtered, rangeDays as 1 | 7 | 30, now), [filtered, rangeDays, now]);

  const animalUnknownCount = filtered.filter((i) => !i.animal.group).length;
  const animalUnknownDominant = filtered.length >= 4 && animalUnknownCount / filtered.length > 0.5;

  // P55 — role emphasis: presentation only; no widget is hidden entirely,
  // because preview roles are not authorization.
  const rolePriority: "attention-first" | "map-first" | "transfer-first" =
    activeRole?.role === "dispatcher" || activeRole?.role === "organization_coordinator" || activeRole?.role === "organization_administrator"
      ? "attention-first"
      : activeRole?.role === "rehabilitator" || activeRole?.role === "veterinary_professional"
        ? "transfer-first"
        : "map-first";

  // P80 — effective widget order: saved layout wins; otherwise role-recommended.
  const recommendedOrder: WidgetId[] =
    rolePriority === "attention-first"
      ? ["attention", "map", "kpis", "activity", "pipeline", "performance", "aging", "trend", "integrity", "statusDist", "animalDist", "typeDist", "workload"]
      : rolePriority === "transfer-first"
        ? ["map", "attention", "kpis", "activity", "pipeline", "aging", "performance", "trend", "integrity", "statusDist", "animalDist", "typeDist", "workload"]
        : ["map", "attention", "kpis", "activity", "pipeline", "performance", "aging", "trend", "integrity", "statusDist", "animalDist", "typeDist", "workload"];
  const widgetOrder: WidgetId[] = layout?.order ?? recommendedOrder;
  const hiddenWidgets = useMemo(() => new Set<WidgetId>(layout?.hidden ?? []), [layout]);

  const persistLayout = (next: DashboardLayout) => {
    setLayout(next);
    void setSetting(DASHBOARD_LAYOUT_KEY, next);
  };
  const moveWidget = (id: WidgetId, dir: -1 | 1) => {
    if (!layout) return; // reordering implies a customized layout
    const order = [...layout.order];
    const idx = order.indexOf(id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= order.length) return;
    [order[idx], order[to]] = [order[to]!, order[idx]!];
    persistLayout({ order, hidden: [...layout.hidden] });
  };

  const attentionCards = useMemo(() => {
    // 0.3: tiles for the responsive attention band (priority = deterministic
    // operational state, most severe first). "Unassigned" joins the band so
    // the whole attention surface is one prioritized queue.
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

  if (!loaded) return <main className="content wide" id="main-content" />;

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const mapPanel = (
    <div className="card ops-panel ops-span-8">
      <div className="row between">
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.map size={16} /> {t("mapTitle", { defaultValue: "Service area operations" })}
        </h3>
        <Link to="/network?view=map" className="btn btn-ghost btn-sm">{t("openFullMap", { defaultValue: "Open full map" })}</Link>
      </div>
      <div style={{ marginTop: "var(--space-3)" }}>
        {settings.mapTilesEnabled === false ? (
          <Suspense fallback={<p style={{ color: "var(--c-ink-faint)" }}>…</p>}>
            <NetworkMap
              incidents={inArea}
              privacy="approximate"
              compact
              serviceArea={area}
              fitMode="service-area"
              offline
              onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<p style={{ color: "var(--c-ink-faint)" }}>…</p>}>
            <NetworkMap
              incidents={inArea}
              privacy="approximate"
              compact
              serviceArea={area}
              fitMode="service-area"
              onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );

  const attentionPanel = (
    <section className="ops-span-12" aria-labelledby="attn-title">
      <h2 id="attn-title" className="section-label" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-2)" }}>
        <span className="ops-live-dot" aria-hidden="true" />
        {t("needsAttention", { defaultValue: "Needs attention" })}
      </h2>
      {attentionCards.length === 0 ? (
        <div className="attn-band attn-clear" role="status">
          <Icons.check size={16} />
          <span>{t("attentionClear", { defaultValue: "Nothing needs attention right now." })}</span>
        </div>
      ) : (
        <div className="attn-band">
          {attentionCards.map((c) => (
            <button key={c.key} className={`attn-tile severity-${c.severity}`} onClick={() => navigate(c.to)}>
              <span className="attn-tile-icon" aria-hidden="true">{c.icon}</span>
              <span className="attn-tile-body">
                <span className="attn-tile-count">{c.count}</span>
                <span className="attn-tile-label">{c.reason}</span>
                {c.time && <span className="attn-tile-detail">{t("attnOldest", { defaultValue: "Oldest: {{time}}", time: c.time })}</span>}
              </span>
              <span className="attn-tile-action">{c.action} <Icons.chevronRight size={12} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const activityWidget = (
    <div className="card ops-panel ops-span-6" style={{ display: "flex", flexDirection: "column" }}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.activity size={16} /> {t("liveActivity", { defaultValue: "Live activity" })}
      </h3>
      {feed.length === 0 ? (
        <p className="hint" style={{ flex: 1 }}>{t("feedEmpty", { defaultValue: "Timeline events from your records will appear here." })}</p>
      ) : (
        <ol className="ops-feed" aria-label={t("liveActivity", { defaultValue: "Live activity" })} style={{ flex: 1 }}>
          {feed.slice(0, 9).map((e, idx) => (
            <li key={`${e.incidentId}-${idx}`}>
              <button onClick={() => navigate(`/incidents/${e.incidentId}`)} className="ops-feed-item">
                <span className="ops-feed-time">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="ops-feed-body">
                  <span className="ops-feed-event" data-evt={e.eventType}>{e.summary}</span>
                  <span className="ops-feed-ref">{e.incidentRef}{e.animalLabel ? ` · ${e.animalLabel}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  const kpisWidget = (
    <div className="kpi-row kpi-strip ops-span-12">
      <KpiCard label={t("kpiNewReports", { defaultValue: "New reports" })} value={newWithDelta.value} delta={newWithDelta.delta} accent />
      <KpiCard label={t("kpiUnassigned", { defaultValue: "Unassigned" })} value={kpis.unassigned} context={metrics.oldestUnassignedHours != null ? t("kpiOldestShort", { defaultValue: "oldest {{t}}", t: formatH(metrics.oldestUnassignedHours) }) : undefined} />
      <KpiCard label={t("kpiActiveResponse", { defaultValue: "Active response" })} value={kpis.responderAssigned + kpis.inResponse} />
      <KpiCard label={t("kpiAwaitingHandoff", { defaultValue: "Awaiting handoff" })} value={kpis.awaitingTransfer} />
      <KpiCard label={t("kpiOpenTotal", { defaultValue: "Open total" })} value={kpis.openTotal} />
      <KpiCard label={t("kpiResolvedToday", { defaultValue: "Resolved today" })} value={metrics.resolvedToday} />
    </div>
  );

  const pipelineWidget = (
    <div className="card ops-panel ops-span-12" style={{ display: "flex", flexDirection: "column" }}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.zap size={16} /> {t("pipelineTitle", { defaultValue: "Response flow" })}
      </h3>
      {/* 0.3 Response Flow v3: stage rail, nothing selected by default; the
          case drawer mounts only after a stage is selected and derives from
          the same `filtered` scope as the stage counts. */}
      <ResponseFlow scope={filtered} />
    </div>
  );

  const performanceWidget = (
    <div className="card ops-panel ops-span-6">
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
  );

  const agingWidget = (
    <div className="card ops-panel ops-span-6">
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
  );

  const trendWidget = (
    <div className="card ops-panel ops-span-12">
      <div className="row between">
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.activity size={16} /> {t("reportsOverTime", { defaultValue: "Reports over time" })}
        </h3>
        <div className="segmented" role="group" aria-label="Time range">
          {([1, 7, 30, 90] as const).map((d) => (
            <button key={d} aria-pressed={range === d} onClick={() => setRange(d)}>{d === 1 ? t("range24h", { defaultValue: "24 hours" }) : t("rangeDays", { defaultValue: "{{d}} days", d })}</button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "var(--space-3)" }}>
        <TrendChart points={series} />
      </div>
    </div>
  );

  const statusDistWidget = (
    <div className="card ops-panel ops-span-4">
      <h3 style={{ marginTop: 0 }}>{t("openByStatus", { defaultValue: "Open by status" })}</h3>
      <BarDistribution entries={statusDist} onPick={() => navigate("/incidents?category=active")} />
    </div>
  );

  const animalDistWidget = (
    <div className="card ops-panel ops-span-4">
      <h3 style={{ marginTop: 0 }}>{t("animalGroups", { defaultValue: "Animal groups" })}</h3>
      {animalUnknownDominant ? (
        <div>
          <p style={{ fontSize: "0.8rem", letterSpacing: "0.06em", color: "var(--c-warn)", textTransform: "uppercase", margin: "0 0 6px" }}>
            {t("dataQuality", { defaultValue: "Data quality" })}
          </p>
          <p style={{ margin: 0, color: "var(--c-ink-soft)", fontSize: "0.92rem" }}>
            {t("animalQualityNote", { defaultValue: "Animal group is missing for most reports." })}{" "}
            ({animalUnknownCount}/{filtered.length})
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate("/incidents?category=active")}>
            {t("reviewMissingData", { defaultValue: "Review missing data" })}
          </button>
        </div>
      ) : (
        <BarDistribution entries={animalDist} onPick={() => navigate("/incidents")} />
      )}
    </div>
  );

  const typeDistWidget = (
    <div className="card ops-panel ops-span-4">
      <h3 style={{ marginTop: 0 }}>{t("incidentTypes", { defaultValue: "Incident types" })}</h3>
      <BarDistribution entries={typeDist} onPick={() => navigate("/incidents")} />
      <p style={{ color: "var(--c-ink-faint)", fontSize: "0.78rem", margin: "var(--space-2) 0 0" }}>
        {t("typeNote", { defaultValue: "Categories reflect what reporters selected — no cause is implied beyond the record." })}
      </p>
    </div>
  );

  const workloadWidget = workload.length > 0 ? (
    <div className="card ops-panel ops-span-12">
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
  ) : null;

  const integrityWidget = integrityReview.queue.length === 0 ? null : (
    <div className="card ops-panel ops-span-6" data-testid="integrity-review">
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.shield size={16} /> {t("integrityTitle", { defaultValue: "Report integrity review" })}
      </h3>
      <p className="hint" style={{ marginBottom: 8 }}>
        {t("integrityNote", { defaultValue: "Review hints from report patterns — never proof of fraud, never auto-rejected. You decide." })}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {integrityReview.queue.slice(0, 5).map((item) => (
          <li key={item.incident.id} className="row between" style={{ borderTop: "1px solid var(--c-border)", padding: "7px 0", gap: 8, flexWrap: "wrap" }}>
            <span style={{ minWidth: 0 }}>
              <Link to={`/incidents/${item.incident.id}`}>{item.incident.humanReference}</Link>
              <span className="hint" style={{ display: "block", margin: 0 }}>
                {item.signals.map((sig) => t(`integritySignal_${sig.key}`, {
                  defaultValue: sig.key.replaceAll("_", " "),
                })).join(" · ")}
              </span>
            </span>
            <button
              className="btn btn-quiet btn-sm"
              onClick={async () => {
                const { dismissSignal } = await import("../integrity/integrityService");
                let next = item.incident;
                for (const sig of item.signals) next = dismissSignal(next, sig.key);
                const { putIncident: put } = await import("../../storage/repositories");
                await put(next);
                showToast(t("integrityDismissedToast", { defaultValue: "Signals dismissed for this report" }));
                await refresh();
              }}
            >
              {t("integrityDismiss", { defaultValue: "Dismiss signals" })}
            </button>
          </li>
        ))}
      </ul>
      {integrityReview.queue.length > 5 && (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          {t("integrityMore", { defaultValue: "{{n}} more reports with review hints — open Incidents to review them.", n: integrityReview.queue.length - 5 })}
        </p>
      )}
    </div>
  );

  const widgetNodes: Record<WidgetId, JSX.Element | null> = {
    map: mapPanel,
    attention: attentionPanel,
    activity: activityWidget,
    kpis: kpisWidget,
    pipeline: pipelineWidget,
    performance: performanceWidget,
    aging: agingWidget,
    trend: trendWidget,
    statusDist: statusDistWidget,
    animalDist: animalDistWidget,
    typeDist: typeDistWidget,
    workload: workloadWidget,
    integrity: integrityWidget,
  };

  const widgetLabels: Record<WidgetId, string> = {
    map: t("widgetMap", { defaultValue: "Service area map" }),
    attention: t("needsAttention", { defaultValue: "Needs attention" }),
    activity: t("liveActivity", { defaultValue: "Live activity" }),
    kpis: t("widgetPulse", { defaultValue: "Operational pulse" }),
    pipeline: t("pipelineTitle", { defaultValue: "Response flow" }),
    performance: t("performance", { defaultValue: "Response performance" }),
    aging: t("caseAging", { defaultValue: "Case aging" }),
    trend: t("reportsOverTime", { defaultValue: "Reports over time" }),
    statusDist: t("openByStatus", { defaultValue: "Open by status" }),
    animalDist: t("animalGroups", { defaultValue: "Animal groups" }),
    typeDist: t("incidentTypes", { defaultValue: "Incident types" }),
    workload: t("workload", { defaultValue: "Responder workload" }),
    integrity: t("integrityTitle", { defaultValue: "Report integrity review" }),
  };

  return (
    <main className="content wide" id="main-content">
      {/* ---- Operations header (P42): compact command strip ---- */}
      <div className="ops-topbar fade-in">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>
            {firstName
              ? t("opsGreeting", {
                  defaultValue: "Welcome, {{name}}",
                  name: firstName,
                  interpolation: { escapeValue: false },
                  context: daypart(),
                })
              : t("opsWelcomeBack", { defaultValue: "Welcome back" })}
          </h1>
          <p style={{ margin: "2px 0 0", color: "var(--c-ink-faint)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{now.toLocaleDateString(countryDateLocale(settings.country) ?? undefined, { weekday: "long" })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("opsLiveTitle", { defaultValue: "Local operations" })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("opsOpenCount", { defaultValue: "{{count}} open incidents", count: kpis.openTotal })}</span>
            {kpis.unassigned > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="ops-flag-warn">{t("opsNeedAssignment", { defaultValue: "{{count}} need assignment", count: kpis.unassigned })}</span>
              </>
            )}
            {attention.handoffWaiting.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="ops-flag-warn">{t("opsHandoffsWaiting", { defaultValue: "{{count}} handoffs waiting", count: attention.handoffWaiting.length })}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{t("opsUpdatedNow", { defaultValue: "Updated" })} {now.toLocaleTimeString(countryDateLocale(settings.country) ?? [], { hour: "2-digit", minute: "2-digit" })}</span>
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
          <button
            className="btn btn-ghost btn-sm"
            data-testid="customize-dashboard"
            aria-haspopup="dialog"
            onClick={() => setCustomizeOpen(true)}
          >
            <Icons.list size={14} /> {t("customize", { defaultValue: "Customize" })}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            data-testid="test-view"
            aria-pressed={testView}
            onClick={async () => {
              const next = !testView;
              setTestView(next);
              await setSetting("network-test-view", next);
              if (next) {
                const { buildDemoIncidents } = await import("../tutorial/demoData");
                const existing = new Set((incidents ?? []).map((i) => i.id));
                for (const d of buildDemoIncidents()) {
                  if (!existing.has(d.id)) await putIncident(d);
                }
                await refresh();
              }
            }}
          >
            <Icons.eye size={14} /> {t("testView", { defaultValue: "Test view" })}
          </button>
        </div>
      </div>

      {testView && (
        <div className="notice warning" role="status" style={{ marginTop: "var(--space-3)" }}>
          <Icons.eye size={16} />
          <span>{t("testViewBanner", { defaultValue: "Test view — fictional demo incidents are mixed into this dashboard for training. Nothing here touches real records, and exports keep their fictional-demo labels." })}</span>
        </div>
      )}

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
                { value: "today", label: t("filterTimeToday", { defaultValue: "Last 24h" }) },
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
      ) : tab === "list" ? (
        <div className="ops-12" style={{ marginTop: "var(--space-4)" }}>
          {/* P80 — widgets render in the user's saved order (role-recommended by default).
              The map is the primary context and cannot be hidden. */}
          {widgetOrder
            .filter((id) => id !== "map") // List view has no map — Map view is the map
            .filter((id) => !hiddenWidgets.has(id))
            .map((id) => (
              <Fragment key={id}>{widgetNodes[id]}</Fragment>
            ))}

          <p className="hint ops-span-12" style={{ margin: 0 }}>
            {t("updatedLine", { defaultValue: "Live from this device's local data store" })} ({now.toLocaleTimeString()})
          </p>
        </div>
      ) : null}

      {tab === "map" ? (
        <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-3)" }}>
          <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.map size={18} /> {t("mapTitle", { defaultValue: "Service area operations" })}
              </h2>
              <p className="hint" style={{ margin: 0 }}>
                {area.label ?? t("serviceAreaFallbackLabel", { defaultValue: "Service area" })} · {area.radiusKm} km {t("serviceAreaRadiusSuffix", { defaultValue: "radius" })}
                {area.centerLat != null && area.centerLon != null && <> · {area.centerLat.toFixed(3)}, {area.centerLon.toFixed(3)}</>}
                {" · "}{inArea.length} {t("serviceAreaIncidentsIn", { defaultValue: "incidents inside" })}
              </p>
            </div>
            <Link className="btn btn-secondary btn-sm" to="/network">{t("backToOps", { defaultValue: "Back to operations" })}</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "var(--space-3)", alignItems: "start" }} className="fullmap-grid">
            <Suspense fallback={<p style={{ color: "var(--c-ink-faint)" }}>Loading map…</p>}>
              <NetworkMap
                incidents={inArea}
                privacy="approximate"
                full
                serviceArea={area}
                fitMode="service-area"
                onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
              />
            </Suspense>
            <aside className="card" style={{ padding: 0, maxHeight: "calc(100dvh - 240px)", overflowY: "auto" }} aria-label={t("mapSidePanel", { defaultValue: "Incidents in view" })}>
              <div style={{ padding: "10px var(--space-3)", borderBottom: "1px solid var(--c-border)", position: "sticky", top: 0, background: "var(--c-surface)" }}>
                <strong>{t("mapSidePanel", { defaultValue: "Incidents in view" })}</strong>
                <span className="hint" style={{ display: "block", margin: 0 }}>{inArea.length}</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {inArea.map((i) => (
                  <li key={i.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                    <Link to={`/incidents/${i.id}`} className="map-side-item" style={{ display: "block", padding: "9px var(--space-3)" }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <strong style={{ fontSize: "0.88rem" }}>{animalLabel(i)}</strong>
                        <StatusBadge status={i.status} />
                      </span>
                      <span className="hint" style={{ display: "block", margin: "2px 0 0" }}>
                        {i.humanReference} · {relativeTime(i.occurredAt ?? i.createdAt)}{i.location.description ? ` · ${i.location.description}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      ) : (
        <>
          {duplicates.length > 0 && (
            <div className="notice warning" style={{ marginTop: "var(--space-4)" }}>
              <Icons.warning size={18} />
              <div>
                <strong>{t("possibleDuplicates", { defaultValue: "Possible duplicate reports" })}</strong> —{" "}
                {t("duplicateNote", { defaultValue: "these incidents look similar by location, time and description. Nothing is merged automatically; review them:" })}
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

          <div className="row between" style={{ marginTop: "var(--space-5)", flexWrap: "wrap", gap: 8 }}>
            <h2 className="section-label" style={{ margin: 0 }}>{t("incidentQueue", { defaultValue: "Incident queue" })} ({inArea.length})</h2>
            <div className="segmented" role="group" aria-label={t("density", { defaultValue: "Density" })}>
              <button aria-pressed={density === "cards"} onClick={() => setDensity("cards")}>{t("densityCards", { defaultValue: "Cards" })}</button>
              <button aria-pressed={density === "table"} onClick={() => setDensity("table")}>{t("densityTable", { defaultValue: "Table" })}</button>
            </div>
          </div>

          {FEED_GROUPS.map((group) => {
            const all = grouped[group.id]!;
            if (all.length === 0) return null;
            // Render cap: keep the DOM bounded with very large local datasets;
            // the full set stays available in Incidents with filters/search.
            const MAX_ROWS = 50;
            const list = all.slice(0, MAX_ROWS);
            const hidden = all.length - list.length;
            return (
              <section key={group.id} style={{ marginTop: "var(--space-4)" }}>
                <h3 className="section-label">{t(group.id === "new" ? "newGroup" : group.id)} ({all.length})</h3>
                {hidden > 0 && <p className="hint">{t("queueTruncated", { defaultValue: "Showing the {{shown}} most recent of {{total}} — open Incidents for the full list.", shown: list.length, total: all.length })}</p>}
                {density === "table" ? (
                  <div className="ops-table-wrap card" style={{ padding: 0 }}>
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th scope="col">{t("colIncident", { defaultValue: "Incident" })}</th>
                          <th scope="col">{t("colAnimal", { defaultValue: "Animal" })}</th>
                          <th scope="col">{t("colStatus", { defaultValue: "Status" })}</th>
                          <th scope="col">{t("colAge", { defaultValue: "Age" })}</th>
                          <th scope="col">{t("colLocation", { defaultValue: "Location" })}</th>
                          <th scope="col">{t("colAssignment", { defaultValue: "Assignment" })}</th>
                          <th scope="col" style={{ textAlign: "right" }}>{t("colActions", { defaultValue: "Actions" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((i) => (
                          <tr key={i.id}>
                            <td><Link to={`/incidents/${i.id}`}>{i.humanReference}</Link>{dupIds.has(i.id) ? " ⚑" : ""}</td>
                            <td>{animalLabel(i)}</td>
                            <td><StatusBadge status={i.status} /></td>
                            <td>{relativeTime(i.occurredAt ?? i.createdAt)}</td>
                            <td style={{ maxWidth: 220 }}>{i.location.description ?? "—"}</td>
                            <td>{i.custody.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested" ? (i.custody.find((c) => !c.endedAt)?.holder ?? "—") : t("colUnassigned", { defaultValue: "Unassigned" })}</td>
                            <td>
                              <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    {list.map((i) => {
                      const dist = distanceFromArea(i, area);
                      return (
                        <IncidentQueueRow
                          key={i.id}
                          incident={i}
                          title={animalLabel(i)}
                          attention={dupIds.has(i.id) ? t("possibleDuplicateShort", { defaultValue: "possible duplicate" }) : null}
                          meta={
                            <>
                              {i.humanReference} · {t("reportedAgo", { defaultValue: "Reported" })} {relativeTime(i.occurredAt ?? i.createdAt)}
                              {dist != null && <> · {formatDistance(dist, settings.units)} {t("away", { defaultValue: "away" })}</>}
                              {i.hazards && i.hazards.hazards.length > 0 && <> · {i.hazards.hazards.length} {t("hazards", { defaultValue: "hazards" })}</>}
                            </>
                          }
                          context={i.location.description}
                          actions={[
                            ...(group.id === "new"
                              ? [{
                                  label: t("accept"),
                                  primary: true,
                                  onClick: async () => {
                                    await changeStatus(i, "responder_assigned", settings.displayName || null, `Accepted by ${org?.name ?? "local organization"}`);
                                    showToast(t("acceptedToast", { defaultValue: "Incident accepted — responder assigned" }));
                                    await refresh();
                                  },
                                }]
                              : []),
                            { label: t("review"), to: `/incidents/${i.id}` },
                          ]}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

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
      {/* P80 — dashboard customization dialog. */}
      <Dialog open={customizeOpen} title={t("customizeTitle", { defaultValue: "Customize dashboard" })} onClose={() => setCustomizeOpen(false)}>
        <p className="hint">{t("customizeHint", { defaultValue: "Show, hide and reorder widgets. Your layout is stored on this device only." })}</p>
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="customize-widget-list">
          {widgetOrder.map((id, idx) => {
            const hidden = hiddenWidgets.has(id);
            const canHide = id !== "map";
            return (
              <li key={id} className="row between" style={{ gap: 8, padding: "6px 0", borderBottom: "1px solid var(--c-border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canHide ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={!hidden}
                    disabled={!canHide}
                    onChange={(e) => {
                      if (e.target.checked) {
                        persistLayout({ order: widgetOrder, hidden: [...hiddenWidgets].filter((h) => h !== id) });
                      } else if (id === "attention") {
                        setConfirmHideAttention(true); // never silently (P80)
                      } else {
                        persistLayout({ order: widgetOrder, hidden: [...hiddenWidgets, id] });
                      }
                    }}
                  />
                  <span style={hidden ? { color: "var(--c-ink-faint)" } : undefined}>{widgetLabels[id]}</span>
                </label>
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn btn-quiet btn-sm" aria-label={`${widgetLabels[id]}: ${t("moveUp", { defaultValue: "Move up" })}`} disabled={idx === 0} onClick={() => moveWidget(id, -1)}>↑</button>
                  <button className="btn btn-quiet btn-sm" aria-label={`${widgetLabels[id]}: ${t("moveDown", { defaultValue: "Move down" })}`} disabled={idx === widgetOrder.length - 1} onClick={() => moveWidget(id, 1)}>↓</button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "var(--space-3)" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setLayout(null);
              void setSetting(DASHBOARD_LAYOUT_KEY, null);
              setCustomizeOpen(false);
              showToast(t("layoutRestored", { defaultValue: "Dashboard layout restored" }));
            }}
          >
            {t("restoreLayout", { defaultValue: "Restore recommended layout" })}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setCustomizeOpen(false)}>{t("done", { defaultValue: "Done" })}</button>
        </div>
      </Dialog>

      {/* Hiding Needs Attention is possible but never silent (P80). */}
      <Dialog
        open={confirmHideAttention}
        title={t("attentionHideWarnTitle", { defaultValue: "Hide “Needs attention”?" })}
        onClose={() => setConfirmHideAttention(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmHideAttention(false)}>{t("cancel", { defaultValue: "Cancel" })}</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                persistLayout({ order: widgetOrder, hidden: [...hiddenWidgets, "attention"] });
                setConfirmHideAttention(false);
                setCustomizeOpen(false);
              }}
            >
              {t("attentionHideConfirm", { defaultValue: "Hide it" })}
            </button>
          </>
        }
      >
        <p>{t("attentionHideWarnBody", { defaultValue: "Needs attention surfaces incidents that may be waiting too long, missing a responder, or missing a usable location. You can re-enable it any time from Customize dashboard." })}</p>
      </Dialog>
    </main>
  );
}

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function KpiCard({ label, value, delta, context, accent }: { label: string; value: number; delta?: number | null; context?: string; accent?: boolean }) {
  return (
    <div className={`kpi-card${accent ? " kpi-accent" : ""}`}>
      <AnimatedNumber value={value} />
      {delta != null && (
        <span className={`kpi-delta ${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} <span aria-hidden="true">vs previous period</span>
        </span>
      )}
      {context && <span className="kpi-delta">{context}</span>}
      <span className="kpi-label">{label}</span>
    </div>
  );
}

function formatH(hours: number): string {
  if (hours < 1) return Math.round(hours * 60) + " min";
  if (hours < 48) return Math.round(hours) + " h";
  return Math.round(hours / 24) + " days";
}
