/**
 * Field operations map v4 — pure logic tests (spec 16–30, 90–92, 99–106).
 * No MapLibre/WebGL: everything here is honest, testable logic.
 */
import { describe, it, expect } from "vitest";
import { makeIncident } from "../../export/exportService.test";
import type { Incident } from "../../../types/incident";
import { clusterPoints, type MapPoint } from "../mapProvider";
import {
  buildClusterSummary, buildFieldLens, CAMERA_MEMORY_KEY, DEFAULT_PREFS, deserializeCamera, filterByStatuses,
  filterByTimeRange, formatDistance, formatElevation, greatCircleKm, MAP_V4_PREFS_KEY, providerIdForMode,
  sanitizeCameraStore, sanitizePrefs, serializeCamera, statusesPresent, TERRAIN_DEM, TERRAIN_EXAGGERATION,
  TERRAIN_PITCH,
} from "./v4";

const BOUNDS = { north: 60, south: 40, east: 10, west: -10 };

function point(lat: number, lon: number, state = "reported", refId?: number): MapPoint {
  return { lat, lon, state, label: `p${refId ?? 0}`, refId };
}

function inc(overrides: Partial<Incident> = {}): Incident {
  return makeIncident(overrides);
}

// ---- Spec 17: modes ---------------------------------------------------------

describe("mode → provider mapping (spec 17)", () => {
  it("2D uses the streets raster", () => {
    expect(providerIdForMode("2d", false)).toBe("osm-raster");
  });
  it("satellite uses the Esri raster", () => {
    expect(providerIdForMode("satellite", false)).toBe("esri-satellite");
  });
  it("terrain shares the streets raster (terrain is a real DEM on top, not a new basemap)", () => {
    expect(providerIdForMode("terrain", false)).toBe("osm-raster");
  });
  it("offline collapses every mode to the offline basemap — no tile requests", () => {
    expect(providerIdForMode("2d", true)).toBe("offline-basemap");
    expect(providerIdForMode("satellite", true)).toBe("offline-basemap");
    expect(providerIdForMode("terrain", true)).toBe("offline-basemap");
  });
});

describe("terrain honesty (spec 17/19)", () => {
  it("exaggeration presets are restrained", () => {
    expect(TERRAIN_EXAGGERATION.natural).toBe(1.2);
    expect(TERRAIN_EXAGGERATION.enhanced).toBe(2.2);
  });
  it("uses the real AWS Terrarium DEM", () => {
    expect(TERRAIN_DEM.tiles).toEqual(["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]);
    expect(TERRAIN_DEM.encoding).toBe("terrarium");
    expect(TERRAIN_DEM.tileSize).toBe(256);
    expect(TERRAIN_DEM.maxzoom).toBe(15);
  });
  it("3D pitch is fixed at 55 and restored views start at 0", () => {
    expect(TERRAIN_PITCH).toBe(55);
    expect(DEFAULT_PREFS.mode).toBe("2d");
  });
});

// ---- Spec 22: layer panel filters -------------------------------------------

describe("incident time filter (spec 22)", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  const mk = (hoursAgo: number | null) =>
    inc({ occurredAt: hoursAgo == null ? null : new Date(now - hoursAgo * 3600 * 1000).toISOString(), createdAt: new Date(now - 400 * 3600 * 1000).toISOString() });
  it("filters by occurredAt within the window", () => {
    const list = [mk(2), mk(20), mk(30), mk(200), mk(200 * 24)];
    expect(filterByTimeRange(list, "24h", now)).toHaveLength(2);
    expect(filterByTimeRange(list, "7d", now)).toHaveLength(3);
    expect(filterByTimeRange(list, "30d", now)).toHaveLength(4);
    expect(filterByTimeRange(list, "all", now)).toHaveLength(5);
  });
  it("falls back to createdAt when occurredAt is null", () => {
    const old = inc({ occurredAt: null, createdAt: new Date(now - 100 * 3600 * 1000).toISOString() });
    expect(filterByTimeRange([old], "24h", now)).toHaveLength(0);
    expect(filterByTimeRange([old], "7d", now)).toHaveLength(1);
  });
});

describe("status filter (spec 22)", () => {
  it("multi-select keeps only selected statuses; empty = everything", () => {
    const list = [inc({ status: "reported" }), inc({ status: "in_care" }), inc({ status: "released" })];
    expect(filterByStatuses(list, [])).toHaveLength(3);
    expect(filterByStatuses(list, ["in_care"]).map((i) => i.status)).toEqual(["in_care"]);
    expect(filterByStatuses(list, ["reported", "released"])).toHaveLength(2);
  });
  it("statusesPresent lists only real statuses in legend order", () => {
    const list = [inc({ status: "released" }), inc({ status: "reported" }), inc({ status: "released" })];
    expect(statusesPresent(list, ["reported", "in_care", "released", "deceased"])).toEqual(["reported", "released"]);
    expect(statusesPresent([], ["reported"])).toEqual([]);
  });
});

// ---- Spec 25: measure -------------------------------------------------------

describe("measure distance math (spec 25)", () => {
  it("matches the known London→Paris great-circle (~343.5 km)", () => {
    const km = greatCircleKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(347);
  });
  it("one degree of longitude at the equator ≈ 111.19 km", () => {
    expect(greatCircleKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });
  it("zero distance for identical points", () => {
    expect(greatCircleKm(52.2, 0.1, 52.2, 0.1)).toBeCloseTo(0, 6);
  });
  it("formats metric (km) by default and imperial (mi) on request", () => {
    expect(formatDistance(1.234)).toBe("1.23 km");
    expect(formatDistance(123.4)).toBe("123.4 km");
    expect(formatDistance(1.609344, "imperial")).toBe("1.00 mi");
    expect(formatDistance(100, "imperial")).toBe("62.1 mi");
  });
});

// ---- Spec 92: cluster inspector ---------------------------------------------

describe("cluster aggregation (spec 92)", () => {
  it("carries stable refs through clusterPoints", () => {
    const points = Array.from({ length: 40 }, (_, i) => point(50.9 + (i % 5) * 0.01, -114.0 + Math.floor(i / 5) * 0.01, "reported", i));
    const clusters = clusterPoints(points, 5, BOUNDS);
    expect(clusters.length).toBeGreaterThan(0);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(40);
    const allRefs = clusters.flatMap((c) => c.refs).sort((a, b) => a - b);
    expect(allRefs).toEqual(points.map((_, i) => i));
  });
  it("summarizes count, status breakdown, oldest reference and unassigned count", () => {
    const members = [point(1, 1, "reported", 0), point(1, 1, "in_care", 1), point(2, 2, "reported", 2)];
    const incidents = [
      inc({ humanReference: "WIH-OLD-1", occurredAt: "2026-01-01T00:00:00Z", status: "reported", custody: [] }),
      inc({ humanReference: "WIH-NEW-1", occurredAt: "2026-09-01T00:00:00Z", status: "in_care", custody: [{ id: "c", holder: "Rehab", holderRole: "rehabilitator", location: null, startedAt: "2026-09-01T01:00:00Z", endedAt: null, handoffId: null }] }),
      inc({ humanReference: "WIH-MID-1", occurredAt: "2026-05-01T00:00:00Z", status: "released", custody: [{ id: "c2", holder: "Rehab", holderRole: "rehabilitator", location: null, startedAt: "2026-05-02T00:00:00Z", endedAt: null, handoffId: null }] }),
    ];
    const summary = buildClusterSummary(members, (refId) => incidents[refId]);
    expect(summary.count).toBe(3);
    expect(summary.states).toEqual({ reported: 2, in_care: 1 });
    expect(summary.oldestReference).toBe("WIH-OLD-1");
    // reported (no holder yet) + released case with a closed? — released has open custody → only reported is unassigned
    expect(summary.unassigned).toBe(1);
  });
  it("counts members whose incident is missing but never invents references", () => {
    const summary = buildClusterSummary([point(0, 0, "reported", 99)], () => undefined);
    expect(summary.count).toBe(1);
    expect(summary.oldestReference).toBeNull();
    expect(summary.unassigned).toBe(0);
  });
});

// ---- Spec 90/23: field lens privacy -----------------------------------------

describe("field lens privacy (spec 90/23)", () => {
  const exact: Incident = inc({
    location: { description: null, precision: "exact", landmark: null, address: null, latitude: 52.123456, longitude: 0.654321, notes: null },
  });
  const sensitive: Incident = inc({
    location: { description: null, precision: "sensitive", landmark: null, address: null, latitude: 52.123456, longitude: 0.654321, notes: null },
  });

  it("reports only coarse elevation, never coordinates", () => {
    const lens = buildFieldLens(exact, 41.5);
    expect(lens.elevationM).toBe(41.5);
    expect(lens.includesExactCoordinates).toBe(false);
    expect(JSON.stringify(lens)).not.toContain("52.123456");
    expect(JSON.stringify(lens)).not.toContain("0.654321");
  });
  it("a sensitive incident yields no exact coordinates in any serialization", () => {
    const lens = buildFieldLens(sensitive, 12);
    expect(lens.includesExactCoordinates).toBe(false);
    expect(JSON.stringify(lens)).not.toContain("52.123456");
    expect(JSON.stringify(lens)).not.toContain("0.654321");
    expect(JSON.stringify(lens)).not.toContain("latitude");
  });
  it("lens is null in 2D and formats with an honest tilde", () => {
    expect(buildFieldLens(exact, null).elevationM).toBeNull();
    expect(formatElevation(41.48)).toBe("≈ 41 m");
  });
});

// ---- Spec 99: camera memory ---------------------------------------------------

describe("camera memory (spec 99)", () => {
  const camera = { lng: -114.0719, lat: 50.123456, zoom: 11.234, pitch: 55, bearing: -37.6 };
  it("serialize/roundtrip is exact", () => {
    const stored = serializeCamera(camera);
    const restored = deserializeCamera(JSON.parse(JSON.stringify(stored)));
    expect(restored).toEqual({ lng: -114.0719, lat: 50.12346, zoom: 11.23, pitch: 55, bearing: -38 });
  });
  it("rejects malformed storage without throwing", () => {
    expect(deserializeCamera(null)).toBeNull();
    expect(deserializeCamera({ lng: "x" })).toBeNull();
    expect(sanitizeCameraStore("junk")).toEqual({});
    expect(sanitizeCameraStore({ full: camera, compact: "x" })).toEqual({ full: serializeCamera(camera) });
  });
  it("uses dedicated storage keys", () => {
    expect(MAP_V4_PREFS_KEY).toBe("map-v4-prefs");
    expect(CAMERA_MEMORY_KEY).toBe("map-camera-memory");
  });
});

// ---- Spec 22: prefs sanitization ---------------------------------------------

describe("prefs sanitization", () => {
  it("falls back to defaults for junk storage", () => {
    expect(sanitizePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs("x").mode).toBe("2d");
    expect(sanitizePrefs({ mode: "hologram" }).mode).toBe("2d");
  });
  it("keeps valid stored values field-by-field", () => {
    const prefs = sanitizePrefs({ mode: "terrain", exaggeration: "enhanced", timeRange: "7d", layers: { incidents: false, clusters: true }, statuses: ["reported", 42] });
    expect(prefs.mode).toBe("terrain");
    expect(prefs.exaggeration).toBe("enhanced");
    expect(prefs.timeRange).toBe("7d");
    expect(prefs.layers).toEqual({ incidents: false, clusters: true, serviceArea: true, terrain: true });
    expect(prefs.statuses).toEqual(["reported"]);
  });
});
