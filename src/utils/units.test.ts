import { describe, it, expect } from "vitest";
import { defaultUnitsFor, haversineKm, formatDistance } from "./units";
import { DEFAULT_SETTINGS } from "../types/settings";
import { feedGroupFor, findDuplicateCandidates, inServiceArea, type ServiceArea } from "../features/network/networkService";
import { makeIncident } from "../features/export/exportService.test";
import type { Incident } from "../types/incident";

describe("region defaults", () => {
  it("defaults to imperial only for the US", () => {
    expect(defaultUnitsFor("US")).toBe("imperial");
    expect(defaultUnitsFor("CA")).toBe("metric");
    expect(defaultUnitsFor("GB")).toBe("metric");
    expect(defaultUnitsFor("")).toBe("metric");
  });

  it("formats distances per unit system", () => {
    expect(formatDistance(5, "metric")).toContain("km");
    expect(formatDistance(5, "imperial")).toContain("mi");
  });

  it("computes plausible great-circle distances", () => {
    // London to Paris is about 344 km.
    const d = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(390);
    expect(haversineKm(52, 0, 52, 0)).toBe(0);
  });
});

describe("motion & ambient defaults", () => {
  it("defaults motion to Full and ambient to On", () => {
    expect(DEFAULT_SETTINGS.motion).toBe("full");
    expect(DEFAULT_SETTINGS.ambient).toBe("on");
  });

  it("default location precision respects privacy (approximate)", () => {
    expect(DEFAULT_SETTINGS.defaultLocationPrecision).toBe("approximate");
  });
});

function withStatus(status: Incident["status"]): Incident {
  return makeIncident({ status });
}

describe("network feed grouping", () => {
  it("groups statuses into response stages", () => {
    expect(feedGroupFor(withStatus("reported"))).toBe("new");
    expect(feedGroupFor(withStatus("response_requested"))).toBe("new");
    expect(feedGroupFor(withStatus("responder_assigned"))).toBe("active");
    expect(feedGroupFor(withStatus("awaiting_pickup"))).toBe("active");
    expect(feedGroupFor(withStatus("in_care"))).toBe("transfer");
    expect(feedGroupFor(withStatus("released"))).toBe("closed");
    expect(feedGroupFor(withStatus("closed"))).toBe("closed");
  });
});

describe("service area filtering", () => {
  const area: ServiceArea = { centerLat: 52.2, centerLon: 0.12, radiusKm: 25, label: "test" };

  it("includes incidents inside the radius", () => {
    const inside = makeIncident({ location: { description: null, precision: "exact", landmark: null, address: null, latitude: 52.21, longitude: 0.13, notes: null } });
    expect(inServiceArea(inside, area)).toBe(true);
  });

  it("excludes incidents far outside the radius", () => {
    const far = makeIncident({ location: { description: null, precision: "exact", landmark: null, address: null, latitude: 53.5, longitude: -1.5, notes: null } });
    expect(inServiceArea(far, area)).toBe(false);
  });

  it("includes incidents without coordinates (cannot be placed)", () => {
    const noCoords = makeIncident({ location: { description: "somewhere", precision: "approximate", landmark: null, address: null, latitude: null, longitude: null, notes: null } });
    expect(inServiceArea(noCoords, area)).toBe(true);
  });
});

describe("duplicate candidate detection", () => {
  function nearReport(overrides: Partial<Incident>): Incident {
    return makeIncident({
      incidentType: "injured_wildlife",
      location: { description: "Roadside near wetland", precision: "approximate", landmark: null, address: null, latitude: 52.205, longitude: 0.118, notes: null },
      occurredAt: new Date(Date.now() - 3600_000).toISOString(),
      ...overrides,
    });
  }

  it("flags close-in-time, close-in-space, same-type reports", () => {
    const a = nearReport({});
    const b = nearReport({ animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: "Unknown raptor" } });
    const dups = findDuplicateCandidates([a, b]);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.distanceKm).toBeLessThan(2);
  });

  it("does not flag different incident types or distant reports", () => {
    const a = nearReport({});
    const b = nearReport({ incidentType: "collision" });
    const far = nearReport({ location: { description: null, precision: "exact", landmark: null, address: null, latitude: 53.0, longitude: -1.0, notes: null } });
    expect(findDuplicateCandidates([a, b])).toHaveLength(0);
    expect(findDuplicateCandidates([a, far])).toHaveLength(0);
  });

  it("never auto-merges — detection only returns candidates", () => {
    const a = nearReport({ id: "dup-a" });
    const b = nearReport({ id: "dup-b" });
    const dups = findDuplicateCandidates([a, b]);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.a.id).toBe("dup-a");
    expect(dups[0]!.b.id).toBe("dup-b");
  });
});
