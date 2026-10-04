/**
 * Analytics V5 metric registry (0.3.0-dev.5, spec Part XI).
 *
 * ONE canonical, deterministic source for every analytics metric and time
 * bucket in the app. Charts must derive from these functions — never from
 * ad-hoc counting in a component.
 *
 * Conventions:
 * - All bucketing uses LOCAL time (the operator's device timezone), matching
 *   how reports are read operationally. Local-day boundaries for daily and
 *   weekly buckets; exact clock-hour boundaries for the 24h range.
 * - Counts are integers >= 0. Nothing here interpolates or extrapolates.
 * - 90d uses WEEKLY buckets (13 buckets) for readability; 24h uses hourly;
 *   7d and 30d use daily.
 */

import type { Incident } from "../../../types/incident";

export type AnalyticsRange = 1 | 7 | 30 | 90;
export type MetricId = "reported" | "assigned" | "closed";

export interface MetricDefinition {
  id: MetricId;
  /** Human label. */
  label: string;
  /** What this metric means — surfaced as the "What does this mean?" tooltip. */
  definition: string;
  /** Which events are included. */
  includes: string;
  /** What is deliberately excluded. */
  excludes: string;
}

export const METRIC_REGISTRY: Record<MetricId, MetricDefinition> = {
  reported: {
    id: "reported",
    label: "Reported",
    definition: "New incident reports created during the bucket.",
    includes:
      "Every non-deleted, non-archived incident whose createdAt falls in the bucket. Demo records are excluded unless the caller opts in.",
    excludes: "Deleted and archived records; fictional demo incidents (in real dashboards).",
  },
  assigned: {
    id: "assigned",
    label: "Assigned",
    definition: "Incidents whose response began during the bucket (first responder assignment).",
    includes:
      "The first timeline transition into responder_assigned, read from structured status_changed metadata, per incident.",
    excludes: "Re-assignments after the first; self-noted statuses without a recorded transition.",
  },
  closed: {
    id: "closed",
    label: "Closed",
    definition: "Incidents whose record was closed during the bucket (released, deceased, closed or cancelled).",
    includes:
      "The transition timestamp into any terminal status (released, deceased, closed, cancelled), per incident.",
    excludes: "Records already closed before the window; reopen/re-close cycles count at the latest close only.",
  },
};

export interface BucketCounts {
  reported: number;
  assigned: number;
  closed: number;
}

export interface AnalyticsBucket extends BucketCounts {
  /** Bucket start (inclusive), ISO string. */
  startISO: string;
  /** Bucket end (exclusive), ISO string. */
  endISO: string;
  /** Short axis label, e.g. "3 PM" or "Oct 2" or "Sep 1". */
  label: string;
  /** Full window description for tooltips/detail, e.g. "Oct 4, 3:00 – 4:00 PM". */
  windowLabel: string;
  /** References of incidents counted in this bucket (reported metric). */
  incidentRefs: string[];
  /** IDs for drilldown. */
  incidentIds: string[];
  /** Median minutes from report to first assignment for incidents in this bucket (null when none). */
  medianAssignmentMinutes: number | null;
}

export interface AnalyticsBucketSpec {
  kind: "hour" | "day" | "week";
  count: number;
  ms: number;
}

export function bucketSpecFor(range: AnalyticsRange): AnalyticsBucketSpec {
  switch (range) {
    case 1:
      return { kind: "hour", count: 24, ms: 3600_000 };
    case 7:
      return { kind: "day", count: 7, ms: 86_400_000 };
    case 30:
      return { kind: "day", count: 30, ms: 86_400_000 };
    case 90:
      // Weekly buckets: 13 whole weeks cover the 90-day window.
      return { kind: "week", count: 13, ms: 7 * 86_400_000 };
  }
}

const HOUR_MS = 3600_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((((s[mid - 1] ?? s[mid]!) + s[mid]!) / 2) * 10) / 10;
}

/** Structured status transition reader with legacy tolerance. */
function firstAssignmentTime(inc: Incident): number | null {
  const ev = inc.timeline.find((e) => e.eventType === "status_changed" && e.metadata?.to === "responder_assigned");
  return ev ? new Date(ev.timestamp).getTime() : null;
}

function closeTime(inc: Incident): number | null {
  const terminal = ["released", "deceased", "closed", "cancelled"];
  type TimelineEvent = { eventType: string; timestamp: string; metadata?: Record<string, unknown> };
  let latest: number | null = null;
  for (const e of inc.timeline as TimelineEvent[]) {
    if (e.eventType === "status_changed" && terminal.includes(String(e.metadata?.to))) {
      const t = new Date(e.timestamp).getTime();
      if (latest == null || t > latest) latest = t;
    }
  }
  return latest;
}

export interface BucketOptions {
  range: AnalyticsRange;
  /** Anchor time; defaults to now. Buckets end at the anchor. */
  now?: Date;
  /** Include demo records (Test View dashboards opt in). */
  includeDemo?: boolean;
}

/** Compute the full bucket series for a range. Deterministic given inputs. */
export function computeBuckets(incidents: Incident[], opts: BucketOptions): AnalyticsBucket[] {
  const { range, includeDemo = false } = opts;
  const now = opts.now ?? new Date();
  const spec = bucketSpecFor(range);
  const anchor = now.getTime();

  // Anchor bucket END on the next boundary so partial current buckets are
  // honest (a day bucket that has only lived 3 hours counts what exists).
  const starts: number[] = [];
  const ends: number[] = [];
  if (spec.kind === "hour") {
    const end = Math.ceil(anchor / HOUR_MS) * HOUR_MS;
    for (let i = spec.count - 1; i >= 0; i--) {
      ends.push(end - i * HOUR_MS);
      starts.push(end - (i + 1) * HOUR_MS);
    }
  } else {
    const dayStart = startOfLocalDay(now).getTime();
    const end = dayStart + 86_400_000;
    const step = spec.ms;
    for (let i = spec.count - 1; i >= 0; i--) {
      ends.push(end - i * step);
      starts.push(end - (i + 1) * step);
    }
  }

  const buckets: AnalyticsBucket[] = starts.map((start, i) => {
    const end = ends[i]!;
    const s = new Date(start);
    const e = new Date(end);
    const label =
      spec.kind === "hour"
        ? s.toLocaleTimeString([], { hour: "numeric" })
        : spec.kind === "day"
          ? s.toLocaleDateString([], { month: "short", day: "numeric" })
          : s.toLocaleDateString([], { month: "short", day: "numeric" });
    const windowLabel =
      spec.kind === "hour"
        ? `${s.toLocaleDateString([], { month: "short", day: "numeric" })}, ${s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : `${s.toLocaleDateString([], { month: "short", day: "numeric" })} – ${new Date(end - 1).toLocaleDateString([], { month: "short", day: "numeric" })}`;
    return {
      startISO: s.toISOString(),
      endISO: e.toISOString(),
      label,
      windowLabel,
      reported: 0,
      assigned: 0,
      closed: 0,
      incidentRefs: [],
      incidentIds: [],
      medianAssignmentMinutes: null,
    };
  });

  const live = incidents.filter((i) => !i.deletedAt && !i.archivedAt && (includeDemo || !i.isDemo));
  const assignTimes: number[][] = buckets.map(() => []);
  for (const inc of live) {
    const created = new Date(inc.createdAt).getTime();
    let bIdx = buckets.findIndex((_, i) => starts[i]! <= created && created < ends[i]!);
    if (bIdx >= 0) {
      const b = buckets[bIdx]!;
      b.reported += 1;
      b.incidentRefs.push(inc.humanReference);
      b.incidentIds.push(inc.id);
    }
    const at = firstAssignmentTime(inc);
    if (at != null) {
      bIdx = buckets.findIndex((_, i) => starts[i]! <= at && at < ends[i]!);
      if (bIdx >= 0) {
        buckets[bIdx]!.assigned += 1;
        assignTimes[bIdx]!.push((at - created) / 60_000);
      }
    }
    const ct = closeTime(inc);
    if (ct != null) {
      bIdx = buckets.findIndex((_, i) => starts[i]! <= ct && ct < ends[i]!);
      if (bIdx >= 0) buckets[bIdx]!.closed += 1;
    }
  }
  buckets.forEach((b, i) => {
    b.medianAssignmentMinutes = median(assignTimes[i]!);
  });
  return buckets;
}

export interface KpiDefinition {
  id: string;
  label: string;
  definition: string;
}

export const KPI_DEFINITIONS: Record<"reported" | "assigned" | "closed", KpiDefinition> = {
  reported: {
    id: "reported",
    label: "New reports",
    definition: METRIC_REGISTRY.reported.definition,
  },
  assigned: {
    id: "assigned",
    label: "Assigned",
    definition: METRIC_REGISTRY.assigned.definition,
  },
  closed: {
    id: "closed",
    label: "Closed",
    definition: METRIC_REGISTRY.closed.definition,
  },
};
