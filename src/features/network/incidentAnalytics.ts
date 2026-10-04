/**
 * incidentAnalytics — deterministic operational metrics derived ONLY from
 * actual incident records and event timestamps. No visual-label parsing,
 * no fabricated values. This service is the single data source for the
 * professional dashboard; a future network provider can feed the same API.
 *
 * All date bucketing uses LOCAL calendar days derived from stored ISO
 * timestamps (which carry their offset) — UTC midnight is never treated as
 * a local day boundary.
 */
import type { Incident, TimelineEvent } from "../../types/incident";
import { STATUS_LABELS_BY_KEY } from "../incidents/labels";
import { findDuplicateCandidates } from "./networkService";

export interface Kpis {
  newReports: number;
  unassigned: number;
  responderAssigned: number;
  inResponse: number;
  awaitingTransfer: number;
  openTotal: number;
}

export interface NeedsAttention {
  unassignedOld: Incident[];
  missingLocation: Incident[];
  possibleDuplicates: Array<{ a: Incident; b: Incident }>;
  handoffWaiting: Incident[];
}

export interface ResponseTimeMetrics {
  medianHoursToAssignment: number | null;
  medianHoursToPickup: number | null;
  medianHoursToTransfer: number | null;
  oldestUnassignedHours: number | null;
  openedToday: number;
  resolvedToday: number;
  sufficientData: boolean;
}

export interface AgingBuckets {
  under30: number;
  min30to60: number;
  h1to2: number;
  h2to4: number;
  over4: number;
}

export interface DistributionEntry {
  key: string;
  label: string;
  count: number;
}

const OPEN_STATUSES = new Set(["reported", "response_requested", "responder_assigned", "awaiting_pickup", "in_transport", "transferred", "in_care", "veterinary_care", "monitoring"]);
const NEW_STATUSES = new Set(["reported", "response_requested"]);
const IN_RESPONSE_STATUSES = new Set(["responder_assigned", "awaiting_pickup", "in_transport"]);
const TRANSFER_STATUSES = new Set(["transferred", "in_care", "veterinary_care"]);
const RESOLVED_STATUSES = new Set(["released", "deceased", "closed", "cancelled"]);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sortedTimeline(incident: Incident): TimelineEvent[] {
  return [...incident.timeline].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** First event whose structured metadata matches, with legacy summary-text
 *  parsing as a fallback for pre-0.2.0-dev.7 records. */
function milestoneEvent(
  incident: Incident,
  structured: (e: TimelineEvent) => boolean,
  legacy: RegExp
): TimelineEvent | undefined {
  const timeline = sortedTimeline(incident);
  return timeline.find(structured) ?? timeline.find((e) => legacy.test(e.summary));
}

function statusChangedTo(e: TimelineEvent, to: string[]): boolean {
  return e.eventType === "status_changed" && e.metadata?.to != null && to.includes(e.metadata.to);
}

function assignedEvent(incident: Incident): TimelineEvent | undefined {
  return milestoneEvent(incident, (e) => statusChangedTo(e, ["responder_assigned"]), /responder assigned|accepted by/i);
}

function pickupEvent(incident: Incident): TimelineEvent | undefined {
  return milestoneEvent(incident, (e) => statusChangedTo(e, ["awaiting_pickup", "in_transport"]), /contained|pickup|collected/i);
}

function transferEvent(incident: Incident): TimelineEvent | undefined {
  return milestoneEvent(
    incident,
    (e) => e.eventType === "handoff_completed" || statusChangedTo(e, ["transferred"]),
    /transferred|handoff from/i
  );
}

/** Structured resolution timestamp when available (status_changed to a
 *  resolved status); legacy records fall back to updatedAt. */
function resolvedAt(incident: Incident): string | null {
  if (!RESOLVED_STATUSES.has(incident.status)) return null;
  const ev = sortedTimeline(incident).find((e) => statusChangedTo(e, [...RESOLVED_STATUSES]));
  return ev?.timestamp ?? incident.updatedAt;
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export function isOpen(incident: Incident): boolean {
  return OPEN_STATUSES.has(incident.status) && !incident.deletedAt && !incident.archivedAt;
}

export function getOpenCounts(incidents: Incident[]): Kpis {
  const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo);
  const open = live.filter(isOpen);
  return {
    newReports: open.filter((i) => NEW_STATUSES.has(i.status)).length,
    unassigned: open.filter((i) => !i.custody.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested").length,
    responderAssigned: open.filter((i) => i.status === "responder_assigned").length,
    inResponse: open.filter((i) => IN_RESPONSE_STATUSES.has(i.status) && i.status !== "responder_assigned").length,
    awaitingTransfer: open.filter((i) => TRANSFER_STATUSES.has(i.status)).length,
    openTotal: open.length,
  };
}

export function getNeedsAttention(incidents: Incident[], now = new Date()): NeedsAttention {
  const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo);
  const open = live.filter(isOpen);
  const unassignedOld = open
    .filter((i) => NEW_STATUSES.has(i.status) && (now.getTime() - new Date(i.occurredAt ?? i.createdAt).getTime()) > 2 * 3600_000)
    .sort((a, b) => a.occurredAt!.localeCompare(b.occurredAt ?? b.createdAt));
  const missingLocation = open.filter((i) => !i.location.description && i.location.latitude == null && i.location.landmark == null);
  // duplicates among ALL live incidents (spec: detection across records).
  // Perf (dev.15): delegated to the windowed detector — the previous inline
  // O(n²) pair loop froze the dashboard at ~10k records.
  const candidates: Array<{ a: Incident; b: Incident }> = findDuplicateCandidates(live, { maxCandidates: 25 });
  const handoffWaiting = open.filter((i) => i.status === "awaiting_pickup" || i.status === "in_transport");
  return { unassignedOld, missingLocation, possibleDuplicates: candidates, handoffWaiting };
}

export function getResponseTimeMetrics(incidents: Incident[], now = new Date()): ResponseTimeMetrics {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const assignedHours: number[] = [];
  const pickupHours: number[] = [];
  const transferHours: number[] = [];
  for (const inc of live) {
    const created = inc.occurredAt ?? inc.createdAt;
    const assigned = assignedEvent(inc);
    if (assigned) assignedHours.push((new Date(assigned.timestamp).getTime() - new Date(created).getTime()) / 3600_000);
    const pickup = pickupEvent(inc);
    if (pickup) pickupHours.push((new Date(pickup.timestamp).getTime() - new Date(created).getTime()) / 3600_000);
    const transfer = transferEvent(inc);
    if (transfer) transferHours.push((new Date(transfer.timestamp).getTime() - new Date(created).getTime()) / 3600_000);
  }
  const open = live.filter(isOpen);
  const unassigned = open.filter((i) => NEW_STATUSES.has(i.status));
  const oldestUnassignedHours = unassigned.length > 0
    ? Math.max(...unassigned.map((i) => (now.getTime() - new Date(i.occurredAt ?? i.createdAt).getTime()) / 3600_000))
    : null;
  const today = now;
  return {
    medianHoursToAssignment: median(assignedHours),
    medianHoursToPickup: median(pickupHours),
    medianHoursToTransfer: median(transferHours),
    oldestUnassignedHours,
    openedToday: live.filter((i) => isSameLocalDay(i.createdAt, today)).length,
    resolvedToday: live.filter((i) => {
      const at = resolvedAt(i);
      return at != null && isSameLocalDay(at, today);
    }).length,
    sufficientData: assignedHours.length + pickupHours.length + transferHours.length >= 3,
  };
}

export function getAgingBuckets(incidents: Incident[], now = new Date()): AgingBuckets {
  const open = incidents.filter(isOpen);
  const buckets: AgingBuckets = { under30: 0, min30to60: 0, h1to2: 0, h2to4: 0, over4: 0 };
  for (const inc of open) {
    const hours = (now.getTime() - new Date(inc.occurredAt ?? inc.createdAt).getTime()) / 3600_000;
    if (hours < 0.5) buckets.under30++;
    else if (hours < 1) buckets.min30to60++;
    else if (hours < 2) buckets.h1to2++;
    else if (hours < 4) buckets.h2to4++;
    else buckets.over4++;
  }
  return buckets;
}

export function getStatusDistribution(incidents: Incident[]): DistributionEntry[] {
  const open = incidents.filter(isOpen);
  const counts = new Map<string, number>();
  for (const inc of open) counts.set(inc.status, (counts.get(inc.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: STATUS_LABELS_BY_KEY[key as keyof typeof STATUS_LABELS_BY_KEY] ?? key, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAnimalDistribution(incidents: Incident[]): DistributionEntry[] {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const counts = new Map<string, number>();
  for (const inc of live) {
    const key = inc.animal.group ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + (inc.animal.count ?? 1));
  }
  const labels: Record<string, string> = { bird: "Bird", mammal: "Mammal", reptile: "Reptile", amphibian: "Amphibian", fish: "Fish", invertebrate: "Invertebrate", other: "Other", not_sure: "Not sure", unknown: "Unknown" };
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);
}

export function getIncidentTypeDistribution(incidents: Incident[]): DistributionEntry[] {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const counts = new Map<string, number>();
  for (const inc of live) {
    if (!inc.incidentType) continue;
    counts.set(inc.incidentType, (counts.get(inc.incidentType) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    injured_wildlife: "Injury", collision: "Collision", trapped_entangled: "Entanglement",
    orphaned_young: "Orphaned/separated young", hazardous_location: "Hazardous location",
    sick_unusual: "Sick/unusual behavior", dead_wildlife: "Dead wildlife",
    human_wildlife_conflict: "Human-wildlife conflict", other: "Other", not_sure: "Not sure",
  };
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);
}

export function getTransferMetrics(incidents: Incident[]): { awaitingTransfer: number; transferredToday: number; medianWaitHours: number | null; receivingOrganizations: string[] } {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const today = new Date();
  const waits: number[] = [];
  const orgs = new Set<string>();
  let transferredToday = 0;
  for (const inc of live) {
    for (const h of inc.handoffs) {
      if (h.toOrganization) orgs.add(h.toOrganization);
      const created = inc.occurredAt ?? inc.createdAt;
      waits.push((new Date(h.occurredAt).getTime() - new Date(created).getTime()) / 3600_000);
      if (isSameLocalDay(h.occurredAt, today)) transferredToday++;
    }
  }
  return {
    awaitingTransfer: getOpenCounts(incidents).awaitingTransfer,
    transferredToday,
    medianWaitHours: median(waits),
    receivingOrganizations: [...orgs].sort(),
  };
}

export interface TrendPoint { day: string; reported: number; resolved: number }

export interface ActivityFeedEntry {
  timestamp: string;
  eventType: string;
  summary: string;
  incidentId: string;
  incidentRef: string;
  animalLabel: string;
}

/** Live activity feed, derived ONLY from real timeline events of live,
 *  non-demo incidents. Most recent first. */
export function getActivityFeed(incidents: Incident[], limit = 12): ActivityFeedEntry[] {
  const live = new Map(
    incidents
      .filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo)
      .map((i) => [i.id, i])
  );
  const entries: ActivityFeedEntry[] = [];
  for (const inc of live.values()) {
    for (const e of inc.timeline) {
      if (e.eventType === "incident_created" && inc.timeline.length > 1) continue;
      entries.push({
        timestamp: e.timestamp,
        eventType: e.eventType,
        summary: e.summary,
        incidentId: inc.id,
        incidentRef: inc.humanReference,
        animalLabel: inc.animal.species || inc.animal.description || inc.animal.group || "",
      });
    }
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export function getTimeSeries(incidents: Incident[], days: 1 | 7 | 30 | 90, now = new Date()): TrendPoint[] {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const points: TrendPoint[] = [];
  // dev.18: precompute numeric timestamps + resolved times ONCE (O(n)), then
  // bucket with integer comparisons — the previous implementation re-parsed
  // every record's dates for every bucket (O(days x n) Date parses, ~610 ms
  // at 10k incidents x 90 days).
  const resolvedCache = new Map<string, number>();
  const reportedTimes: number[] = new Array(live.length);
  const resolvedTimes: number[] = new Array(live.length);
  for (let idx = 0; idx < live.length; idx++) {
    const i = live[idx]!;
    reportedTimes[idx] = Date.parse(i.createdAt);
    const rid = i.id;
    let rt = resolvedCache.get(rid);
    if (rt === undefined) {
      const at = resolvedAt(i);
      rt = at ? Date.parse(at) : NaN;
      resolvedCache.set(rid, rt);
    }
    resolvedTimes[idx] = rt;
  }
  const countIn = (times: number[], from: number, to: number): number => {
    let c = 0;
    for (let idx = 0; idx < times.length; idx++) {
      const t = times[idx]!;
      if (t >= from && t < to) c++;
    }
    return c;
  };
  // 24 hours: hourly buckets ending now.
  if (days === 1) {
    for (let h = 23; h >= 0; h--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - h);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      const from = start.getTime();
      const to = end.getTime();
      points.push({
        day: start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        reported: countIn(reportedTimes, from, to),
        resolved: countIn(resolvedTimes, from, to),
      });
    }
    return points;
  }
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const from = day.getTime();
    const to = next.getTime();
    points.push({
      day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      reported: countIn(reportedTimes, from, to),
      resolved: countIn(resolvedTimes, from, to),
    });
  }
  return points;
}

export interface ResponderWorkload {
  actor: string;
  assignedCases: number;
  activeCases: number;
  completedToday: number;
}

/** Operational capacity visibility from structured events — explicitly NOT
 *  productivity scoring: no leaderboards, no rankings, no comparisons. */
export function getResponderWorkload(incidents: Incident[], now = new Date()): ResponderWorkload[] {
  const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo);
  const byActor = new Map<string, { assigned: number; active: number; completedToday: number }>();
  const bump = (actor: string | null | undefined, key: "assigned" | "active" | "completedToday") => {
    const name = (actor ?? "").trim();
    if (!name) return;
    const entry = byActor.get(name) ?? { assigned: 0, active: 0, completedToday: 0 };
    entry[key] += 1;
    byActor.set(name, entry);
  };
  for (const inc of live) {
    // Assignment from structured status_changed metadata.
    const assigned = assignedEvent(inc);
    if (assigned) bump(assigned.actor, "assigned");
    // Active = currently holding custody.
    const currentCustody = inc.custody.find((c) => !c.endedAt);
    if (currentCustody) bump(currentCustody.holder, "active");
    // Resolved today with this actor as last event actor.
    const resolved = resolvedAt(inc);
    if (resolved && isSameLocalDay(resolved, now)) {
      const lastEvent = [...inc.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      bump(lastEvent?.actor, "completedToday");
    }
  }
  return [...byActor.entries()]
    .map(([actor, v]) => ({ actor, assignedCases: v.assigned, activeCases: v.active, completedToday: v.completedToday }))
    .sort((a, b) => b.activeCases - a.activeCases || a.actor.localeCompare(b.actor));
}

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  /** Filter category deep-link for the incidents list. */
  to: string;
}

/** Response-flow pipeline (P46): case counts per operational stage, derived
 *  ONLY from current statuses. Click-through filters the incident list. */
export function getPipelineCounts(incidents: Incident[]): PipelineStage[] {
  const open = (i: Incident) => !i.deletedAt && !i.archivedAt && !i.isDemo;
  const live = incidents.filter(open);
  const stageDefs: Array<{ key: string; label: string; statuses: string[]; to: string }> = [
    { key: "reported", label: "Reported", statuses: ["reported", "response_requested"], to: "/incidents?category=awaiting" },
    { key: "assigned", label: "Assigned", statuses: ["responder_assigned"], to: "/incidents?category=active" },
    { key: "enroute", label: "En route", statuses: ["in_transport"], to: "/incidents?category=active" },
    { key: "pickup", label: "Pickup", statuses: ["awaiting_pickup"], to: "/incidents?category=active" },
    { key: "transfer", label: "Transfer", statuses: ["transferred"], to: "/incidents?category=active" },
    { key: "care", label: "Care", statuses: ["in_care", "veterinary_care", "monitoring"], to: "/incidents?category=active" },
    { key: "closed", label: "Closed", statuses: ["released", "deceased", "closed", "cancelled"], to: "/incidents?category=resolved" },
  ];
  return stageDefs.map((d) => ({
    key: d.key,
    label: d.label,
    count: live.filter((i) => d.statuses.includes(i.status)).length,
    to: d.to,
  }));
}

export interface KpiDelta {
  value: number;
  /** Change vs the previous comparable period; null when data does not support a comparison. */
  delta: number | null;
}

/** KPI comparison (P45): current-period count vs previous period of the same
 *  length. Comparison is only produced when the previous period contains at
 *  least one data point — never invented. */
export function getCountWithDelta(
  incidents: Incident[],
  rangeDays: 1 | 7 | 30 | 90,
  now = new Date()
): KpiDelta {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const ms = rangeDays * 86400_000;
  const currentStart = now.getTime() - ms;
  const previousStart = currentStart - ms;
  const inRange = (i: Incident, from: number, to: number) => {
    const t = new Date(i.createdAt).getTime();
    return t >= from && t < to;
  };
  const current = live.filter((i) => inRange(i, currentStart, now.getTime())).length;
  const previous = live.filter((i) => inRange(i, previousStart, currentStart)).length;
  return { value: current, delta: previous > 0 ? current - previous : null };
}
