/** incidentAnalytics determinism tests (spec §65-66, §69). */
import { describe, it, expect } from "vitest";
import {
  getOpenCounts, getNeedsAttention, getResponseTimeMetrics, getAgingBuckets,
  getStatusDistribution, getAnimalDistribution, getIncidentTypeDistribution,
  getTimeSeries, getTransferMetrics,
} from "./incidentAnalytics";
import { makeIncident } from "../export/exportService.test";
import type { Incident } from "../../types/incident";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function statusIncident(status: Incident["status"], ageHours = 1): Incident {
  return makeIncident({ status, createdAt: hoursAgo(ageHours), occurredAt: hoursAgo(ageHours), updatedAt: hoursAgo(ageHours) });
}

describe("open counts", () => {
  it("categorizes statuses into KPIs", () => {
    const incidents = [
      statusIncident("reported"),
      statusIncident("response_requested"),
      statusIncident("responder_assigned"),
      statusIncident("awaiting_pickup"),
      statusIncident("in_care"),
      statusIncident("closed"),
    ];
    const kpis = getOpenCounts(incidents);
    expect(kpis.newReports).toBe(2);
    expect(kpis.responderAssigned).toBe(1);
    expect(kpis.awaitingTransfer).toBe(1);
    expect(kpis.openTotal).toBe(5); // closed excluded
  });

  it("excludes trashed/archived/demo incidents", () => {
    const trashed = statusIncident("reported", 1);
    trashed.deletedAt = new Date().toISOString();
    const demo = statusIncident("reported", 1);
    demo.isDemo = true;
    const kpis = getOpenCounts([trashed, demo]);
    expect(kpis.openTotal).toBe(0);
  });
});

describe("response time metrics", () => {
  it("computes median hours to assignment from real event timestamps", () => {
    const inc = statusIncident("responder_assigned", 2);
    inc.timeline.push({
      eventId: "e1", incidentId: inc.id, eventType: "status_changed",
      timestamp: hoursAgo(1), actor: null,
      summary: "Status changed from Reported to Responder assigned",
      details: null, metadata: null, relatedAttachmentIds: [],
    });
    const metrics = getResponseTimeMetrics([inc]);
    expect(metrics.medianHoursToAssignment).not.toBeNull();
    expect(metrics.medianHoursToAssignment!).toBeGreaterThan(0.5);
    expect(metrics.medianHoursToAssignment!).toBeLessThan(1.5);
  });

  it("reports Not-enough-data (null) when no events exist", () => {
    const metrics = getResponseTimeMetrics([statusIncident("reported", 1)]);
    expect(metrics.medianHoursToAssignment).toBeNull();
    expect(metrics.sufficientData).toBe(false);
  });

  it("computes oldest unassigned age", () => {
    const a = statusIncident("reported", 1);
    const b = statusIncident("response_requested", 5);
    const metrics = getResponseTimeMetrics([a, b]);
    expect(metrics.oldestUnassignedHours!).toBeGreaterThan(4);
  });

  it("counts opened/resolved today using LOCAL calendar days", () => {
    // Anchor inside today's local calendar day so the test is stable right
    // after local midnight (an hour ago can already be yesterday).
    const todayIso = (): string => {
      const d = new Date();
      d.setHours(0, 0, 1, 0);
      return d.toISOString();
    };
    const opened = statusIncident("reported", 1); // created now
    opened.createdAt = todayIso();
    opened.occurredAt = todayIso();
    const resolved = statusIncident("closed", 1);
    resolved.createdAt = todayIso();
    resolved.occurredAt = todayIso();
    resolved.updatedAt = todayIso();
    const metrics = getResponseTimeMetrics([opened, resolved]);
    expect(metrics.openedToday).toBe(2);
    expect(metrics.resolvedToday).toBe(1);
  });
});

describe("aging buckets", () => {
  it("buckets open cases by wait time", () => {
    const incidents = [
      statusIncident("reported", 0.2),  // < 30 min
      statusIncident("reported", 0.75), // 30-60
      statusIncident("reported", 1.5),  // 1-2h
      statusIncident("reported", 3),    // 2-4h
      statusIncident("reported", 6),    // 4+h
    ];
    const buckets = getAgingBuckets(incidents);
    expect(buckets.under30).toBe(1);
    expect(buckets.min30to60).toBe(1);
    expect(buckets.h1to2).toBe(1);
    expect(buckets.h2to4).toBe(1);
    expect(buckets.over4).toBe(1);
  });

  it("closed cases are never aged", () => {
    const buckets = getAgingBuckets([statusIncident("closed", 100)]);
    expect(buckets.over4).toBe(0);
  });
});

describe("distributions", () => {
  it("status distribution counts open cases only, with labels", () => {
    const dist = getStatusDistribution([statusIncident("reported"), statusIncident("reported"), statusIncident("closed")]);
    expect(dist).toHaveLength(1);
    expect(dist[0]!.label).toBe("Reported");
    expect(dist[0]!.count).toBe(2);
  });

  it("animal distribution sums report counts per group", () => {
    const bird = makeIncident({ animal: { group: "bird", species: null, speciesConfirmed: false, count: 3, lifeStage: null, sex: null, description: null } });
    const dist = getAnimalDistribution([bird, statusIncident("reported")]);
    const birdEntry = dist.find((d) => d.key === "bird")!;
    expect(birdEntry.count).toBe(4); // 3 from the bird report + 1 from the raptor report
  });

  it("incident type distribution uses friendly category labels", () => {
    const dist = getIncidentTypeDistribution([makeIncident({ incidentType: "collision" })]);
    expect(dist[0]!.label).toBe("Collision");
  });
});

describe("transfer metrics", () => {
  it("counts awaiting and computes receiving organizations", () => {
    const inc = makeIncident();
    inc.handoffs.push({
      id: "h1", fromParty: "Finder", toParty: "Centre", fromOrganization: null,
      toOrganization: "Green Valley", receivingPerson: null, method: null,
      occurredAt: new Date().toISOString(), conditionNotes: null,
      items: [], notes: null, completedAt: null, recordedBy: null,
    });
    const tm = getTransferMetrics([inc, statusIncident("in_care")]);
    expect(tm.receivingOrganizations).toContain("Green Valley");
    expect(tm.transferredToday).toBe(1);
  });
});

describe("time series", () => {
  it("buckets by local calendar day and returns requested length", () => {
    const points = getTimeSeries([statusIncident("reported", 0.2)], 7);
    expect(points).toHaveLength(7);
    const totalReported = points.reduce((s, p) => s + p.reported, 0);
    expect(totalReported).toBe(1); // today's report lands in the last bucket
  });

  it("is timezone-safe: a UTC-midnight timestamp counts for the local day it falls in", () => {
    // Create an incident at local noon — must count in TODAY's bucket.
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    if (noon.getTime() > Date.now()) noon.setDate(noon.getDate() - 1);
    const inc = makeIncident({ createdAt: noon.toISOString(), occurredAt: noon.toISOString() });
    const points = getTimeSeries([inc], 7);
    const total = points.reduce((s, p) => s + p.reported, 0);
    expect(total).toBe(1);
  });
});

describe("needs attention", () => {
  it("flags old unassigned reports and missing locations", () => {
    const old = statusIncident("reported", 5);
    const noLoc = statusIncident("reported", 1);
    noLoc.location = { description: null, precision: null, landmark: null, address: null, latitude: null, longitude: null, notes: null };
    const attention = getNeedsAttention([old, noLoc]);
    expect(attention.unassignedOld).toHaveLength(1);
    expect(attention.missingLocation).toHaveLength(1);
  });

  it("does not flag recent well-located reports", () => {
    const attention = getNeedsAttention([statusIncident("reported", 0.5)]);
    expect(attention.unassignedOld).toHaveLength(0);
    expect(attention.missingLocation).toHaveLength(0);
  });
});
