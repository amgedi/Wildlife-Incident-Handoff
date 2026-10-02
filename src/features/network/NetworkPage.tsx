/**
 * Response network dashboard — LOCAL PREVIEW build.
 *
 * Shows the professional incident feed over LOCAL incidents with a mock
 * service area and mock organization registry. Nothing is transmitted
 * anywhere; this validates the dashboard UX and the data model that a real
 * backend would implement (docs/NETWORK_ARCHITECTURE.md).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { useTranslation } from "react-i18next";
import { useIncidents } from "../incidents/IncidentCard";
import { Icons } from "../../components/Icons";
import { EmptyState, StatusBadge, TextField } from "../../components/ui";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";
import {
  FEED_GROUPS, LOCAL_ORG_REGISTRY, distanceFromArea, feedGroupFor,
  findDuplicateCandidates, inServiceArea, type ServiceArea,
} from "./networkService";
import { formatDistance } from "../../utils/units";
const NetworkMap = lazy(() => import("./NetworkMap").then((m) => ({ default: m.NetworkMap })));
import { useNavigate } from "react-router-dom";
import { getSetting, setSetting } from "../../storage/repositories";
import { Suspense, lazy, useEffect } from "react";
import { changeStatus } from "../../storage/incidentService";
import * as analytics from "./incidentAnalytics";
import { TrendChart } from "./TrendChart";

export function NetworkPage() {
  const { incidents, refresh } = useIncidents();
  const { settings, showToast } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation("professional");
  const [tab, setTab] = useState<"list" | "map">("list");
  const [area, setArea] = useState<ServiceArea>({ centerLat: null, centerLon: null, radiusKm: 25, label: "My service area" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSetting<ServiceArea>("network-service-area").then((saved) => {
      if (saved) setArea(saved);
      setLoaded(true);
    });
  }, []);

  const saveArea = (next: ServiceArea) => {
    setArea(next);
    void setSetting("network-service-area", next);
  };

  const org = LOCAL_ORG_REGISTRY[0];
  const live = useMemo(() => (incidents ?? []).filter((i) => !i.deletedAt && !i.archivedAt), [incidents]);
  const inArea = useMemo(() => live.filter((i) => inServiceArea(i, area)), [live, area]);
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

  const [range, setRange] = useState<1 | 7 | 30>(7);
  const kpis = useMemo(() => analytics.getOpenCounts(live), [live]);
  const metrics = useMemo(() => analytics.getResponseTimeMetrics(live), [live]);
  const aging = useMemo(() => analytics.getAgingBuckets(live), [live]);
  const statusDist = useMemo(() => analytics.getStatusDistribution(live), [live]);
  const animalDist = useMemo(() => analytics.getAnimalDistribution(live), [live]);
  const typeDist = useMemo(() => analytics.getIncidentTypeDistribution(live), [live]);
  const transfer = useMemo(() => analytics.getTransferMetrics(live), [live]);
  const series = useMemo(() => analytics.getTimeSeries(live, range), [live, range]);
  const attention = analytics.getNeedsAttention(live);
  const attentionItems = useMemo(() => {
    const items: Array<{ label: string; to: string }> = [];
    if (kpis.unassigned > 0) items.push({ label: `${kpis.unassigned} unassigned report${kpis.unassigned === 1 ? "" : "s"}`, to: "/incidents?category=awaiting" });
    if (attention.unassignedOld.length > 0) items.push({ label: `${attention.unassignedOld.length} report${attention.unassignedOld.length === 1 ? "" : "s"} waiting over 2 hours`, to: "/incidents?category=awaiting" });
    if (attention.handoffWaiting.length > 0) items.push({ label: `${attention.handoffWaiting.length} handoff${attention.handoffWaiting.length === 1 ? "" : "s"} awaiting pickup`, to: "/incidents?category=active" });
    if (attention.missingLocation.length > 0) items.push({ label: `${attention.missingLocation.length} report${attention.missingLocation.length === 1 ? "" : "s"} missing a usable location`, to: "/incidents?category=active" });
    if (attention.possibleDuplicates.length > 0) items.push({ label: `${attention.possibleDuplicates.length} possible duplicate${attention.possibleDuplicates.length === 1 ? "" : "s"}`, to: "/incidents" });
    return items;
  }, [kpis, attention]);

  if (!loaded) return <main className="content" id="main-content" />;

  return (
    <main className="content wide" id="main-content">
      <div className="row between" style={{ flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{t("title")}</h1>
          <p style={{ color: "var(--c-ink-faint)", fontSize: "0.88rem", margin: "4px 0 0" }}>
            <span className="demo-banner" style={{ marginRight: 8 }}>{t("localPreview")}</span>
            {t("localPreviewNote", { org: org?.name ?? "" })}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Dashboard view">
          <button aria-pressed={tab === "list"} onClick={() => setTab("list")}>{t("list")}</button>
          <button aria-pressed={tab === "map"} onClick={() => setTab("map")}>{t("map")}</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <h3 style={{ marginTop: 0 }}>{t("serviceArea")}</h3>
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
          {t("serviceAreaNote")}
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <TextField label="Center latitude" type="number" step="any" value={area.centerLat?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLat: v ? parseFloat(v) : null })} optional />
          <TextField label="Center longitude" type="number" step="any" value={area.centerLon?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLon: v ? parseFloat(v) : null })} optional />
          <TextField label="Radius (km)" type="number" value={area.radiusKm.toString()} onChange={(v) => saveArea({ ...area, radiusKm: Math.max(1, parseFloat(v) || 25) })} />
        </div>
      </div>

      {/* ---- Operational dashboard (live from local data) ---- */}
      {live.length === 0 ? (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <EmptyState
            icon={<Icons.handoff size={40} />}
            title="No incident data yet"
            hint="Analytics appear here as soon as real incidents exist on this device."
            action={
              <Link className="btn btn-secondary" to="/examples">Open fictional dashboard demo</Link>
            }
          />
          <p style={{ color: "var(--c-ink-faint)", fontSize: "0.8rem", textAlign: "center", margin: 0 }}>
            Demo analytics are clearly labeled FICTIONAL DEMO and never mix with real records.
          </p>
        </div>
      ) : (
        <>
          <div className="kpi-row" style={{ marginTop: "var(--space-4)" }}>
            <KpiCard label="New reports" value={kpis.newReports} />
            <KpiCard label="Unassigned" value={kpis.unassigned} />
            <KpiCard label="Responder assigned" value={kpis.responderAssigned} />
            <KpiCard label="In response" value={kpis.inResponse} />
            <KpiCard label="Awaiting transfer" value={kpis.awaitingTransfer} />
            <KpiCard label="Open total" value={kpis.openTotal} />
          </div>

          {attentionItems.length > 0 && (
            <div className="card" style={{ marginTop: "var(--space-4)", borderColor: "var(--c-warn)" }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.warning size={18} style={{ color: "var(--c-warn)" }} />
                Needs attention
              </h3>
              <div className="stack">
                {attentionItems.map((item, i) => (
                  <button key={i} className="btn btn-quiet btn-sm attention-item" onClick={() => navigate(item.to)}>
                    <Icons.warning size={14} style={{ color: "var(--c-warn)" }} /> {item.label}
                    <span style={{ marginLeft: "auto", color: "var(--c-ink-faint)" }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid-2" style={{ marginTop: "var(--space-4)" }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Response performance</h3>
              {metrics.sufficientData ? (
                <dl className="kv">
                  {metrics.medianHoursToAssignment != null && (<><dt>Median time to assignment</dt><dd>{formatH(metrics.medianHoursToAssignment)}</dd></>)}
                  {metrics.medianHoursToPickup != null && (<><dt>Median time to pickup</dt><dd>{formatH(metrics.medianHoursToPickup)}</dd></>)}
                  {metrics.medianHoursToTransfer != null && (<><dt>Median time to transfer</dt><dd>{formatH(metrics.medianHoursToTransfer)}</dd></>)}
                  {metrics.oldestUnassignedHours != null && (<><dt>Oldest unassigned</dt><dd>{formatH(metrics.oldestUnassignedHours)}</dd></>)}
                  <dt>Opened today</dt><dd>{metrics.openedToday}</dd>
                  <dt>Resolved today</dt><dd>{metrics.resolvedToday}</dd>
                </dl>
              ) : (
                <p style={{ color: "var(--c-ink-faint)" }}>Not enough data yet</p>
              )}
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Open case age</h3>
              <dl className="kv">
                <dt>&lt; 30 min</dt><dd>{aging.under30}</dd>
                <dt>30–60 min</dt><dd>{aging.min30to60}</dd>
                <dt>1–2 h</dt><dd>{aging.h1to2}</dd>
                <dt>2–4 h</dt><dd>{aging.h2to4}</dd>
                <dt>4+ h</dt><dd>{aging.over4}</dd>
              </dl>
              <h3 style={{ marginTop: "var(--space-4)" }}>Transfers</h3>
              <dl className="kv">
                <dt>Awaiting transfer</dt><dd>{transfer.awaitingTransfer}</dd>
                <dt>Transferred today</dt><dd>{transfer.transferredToday}</dd>
                {transfer.medianWaitHours != null && (<><dt>Median wait</dt><dd>{formatH(transfer.medianWaitHours)}</dd></>)}
              </dl>
            </div>
          </div>

          <div className="card" style={{ marginTop: "var(--space-4)" }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Reports over time</h3>
              <div className="segmented" role="group" aria-label="Time range">
                {([1, 7, 30] as const).map((d) => (
                  <button key={d} aria-pressed={range === d} onClick={() => setRange(d)}>{d === 1 ? "24 hours" : d + " days"}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <TrendChart points={series} />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "var(--space-4)" }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Open by status</h3>
              <StatusDist entries={statusDist} />
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Animal groups</h3>
              <StatusDist entries={animalDist} />
            </div>
          </div>
          <div className="card" style={{ marginTop: "var(--space-4)" }}>
            <h3 style={{ marginTop: 0 }}>Incident types</h3>
            <StatusDist entries={typeDist} />
            <p style={{ color: "var(--c-ink-faint)", fontSize: "0.82rem", margin: "var(--space-2) 0 0" }}>
              Categories reflect what reporters selected — no cause is implied beyond the record.
            </p>
          </div>
          <p className="hint" style={{ marginTop: "var(--space-3)" }}>
            Updated just now · live from this device's local data store ({new Date().toLocaleTimeString()})
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
                                showToast("Incident accepted — responder assigned");
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
                title="No incidents in your service area yet"
                hint="When incidents with coordinates inside your radius exist on this device, they appear here grouped by response stage."
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}

function formatH(hours: number): string {
  if (hours < 1) return Math.round(hours * 60) + " min";
  if (hours < 48) return Math.round(hours) + " h";
  return Math.round(hours / 24) + " days";
}

function StatusDist({ entries }: { entries: Array<{ key: string; label: string; count: number }> }) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  if (entries.length === 0) return <p style={{ color: "var(--c-ink-faint)" }}>No data yet</p>;
  return (
    <div className="stack" role="list">
      {entries.map((e) => (
        <div key={e.key} role="listitem" style={{ display: "grid", gridTemplateColumns: "minmax(90px, max-content) 1fr minmax(30px, max-content)", gap: 10, alignItems: "center", fontSize: "0.88rem" }}>
          <span>{e.label}</span>
          <span style={{ height: 8, borderRadius: 4, background: "var(--c-surface-alt)", position: "relative", overflow: "hidden" }} aria-hidden="true">
            <span style={{ position: "absolute", inset: 0, width: (e.count / max) * 100 + "%", background: "var(--c-primary)", borderRadius: 4 }} />
          </span>
          <span style={{ fontWeight: 650, textAlign: "right" }}>{e.count}</span>
        </div>
      ))}
    </div>
  );
}
