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

function firstEvent(incident: Incident, summaryPrefix: RegExp): TimelineEvent | undefined {
  return [...incident.timeline]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .find((e) => summaryPrefix.test(e.summary));
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
  // duplicates among ALL live incidents (spec: detection across records)
  const candidates: Array<{ a: Incident; b: Incident }> = [];
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const a = live[x]!, b = live[y]!;
      if (a.incidentType !== b.incidentType) continue;
      const hours = Math.abs(new Date(a.occurredAt ?? a.createdAt).getTime() - new Date(b.occurredAt ?? b.createdAt).getTime()) / 3600_000;
      if (hours > 24) continue;
      const bothCoords = a.location.latitude != null && b.location.latitude != null;
      if (bothCoords && Math.abs(a.location.latitude! - b.location.latitude!) > 0.05) continue;
      candidates.push({ a, b });
    }
  }
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
    const assigned = firstEvent(inc, /responder assigned|accepted by/i);
    if (assigned) assignedHours.push((new Date(assigned.timestamp).getTime() - new Date(created).getTime()) / 3600_000);
    const pickup = firstEvent(inc, /contained|pickup|collected/i);
    if (pickup) pickupHours.push((new Date(pickup.timestamp).getTime() - new Date(created).getTime()) / 3600_000);
    const transfer = firstEvent(inc, /transferred|handoff from/i);
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
    resolvedToday: live.filter((i) => RESOLVED_STATUSES.has(i.status) && isSameLocalDay(i.updatedAt, today)).length,
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

export function getTimeSeries(incidents: Incident[], days: 1 | 7 | 30, now = new Date()): TrendPoint[] {
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  const points: TrendPoint[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const reported = live.filter((i) => {
      const t = new Date(i.createdAt);
      return t >= day && t < next;
    }).length;
    const resolved = live.filter((i) => {
      if (!RESOLVED_STATUSES.has(i.status)) return false;
      const t = new Date(i.updatedAt);
      return t >= day && t < next;
    }).length;
    points.push({
      day: day.toLocaleDateString(undefined, days === 1 ? { hour: "2-digit" } : { month: "short", day: "numeric" }),
      reported,
      resolved,
    });
  }
  return points;
}
