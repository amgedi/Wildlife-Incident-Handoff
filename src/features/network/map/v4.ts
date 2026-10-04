/**
 * Field operations map v4 — pure logic (spec 16–30, 90–92, 99–100, 103–106).
 *
 * Everything in this file is free of MapLibre/DOM side effects so the honesty
 * rules (no fake layers, no privacy weakening) can be unit-tested directly.
 * Map-instance helpers live in v4Map.ts; UI lives in NetworkMap.tsx.
 */
import type { Incident } from "../../../types/incident";

// ---- Modes (spec 17) --------------------------------------------------------

export type MapMode = "2d" | "satellite" | "terrain";

/**
 * Honest mode → basemap mapping. Terrain uses the streets raster plus a real
 * DEM (see TERRAIN_DEM) — never synthesized elevation. When the device is
 * offline every mode collapses to the offline basemap: no tiles are fetched
 * and no pretend imagery is drawn.
 */
export function providerIdForMode(mode: MapMode, offline: boolean): string {
  if (offline) return "offline-basemap";
  if (mode === "satellite") return "esri-satellite";
  return "osm-raster"; // 2d and terrain share the streets raster
}

/** Restrained terrain exaggeration presets (spec 19: "natural" | "enhanced"). */
export type TerrainExaggeration = "natural" | "enhanced";

export const TERRAIN_EXAGGERATION: Record<TerrainExaggeration, number> = {
  natural: 1.2,
  enhanced: 2.2,
};

/** Pitch applied while a 3D terrain mode is active (spec 17). */
export const TERRAIN_PITCH = 55;

/**
 * Real elevation data: AWS Terrain Tiles (Terrarium encoding). Public, no API
 * key. maxzoom 15 is the honest limit of this dataset — we do not pretend
 * higher detail exists.
 */
export const TERRAIN_DEM = {
  id: "mv4-terrain-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium" as const,
  tileSize: 256,
  maxzoom: 15,
  attribution: "Elevation: AWS Terrain Tiles (Mapzen/USGS/NOAA via AWS Open Data)",
};

// ---- Camera memory (spec 99) ------------------------------------------------

export interface CameraMemory {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const CAMERA_MEMORY_KEY = "map-camera-memory";

/** Persisted shape: { full?: CameraMemory, compact?: CameraMemory }. */
export type CameraMemoryStore = Partial<Record<"full" | "compact", CameraMemory>>;

/** Round to storage-stable precision so roundtrips are exact (no float drift). */
export function serializeCamera(camera: CameraMemory): CameraMemory {
  return {
    lng: Math.round(camera.lng * 1e5) / 1e5,
    lat: Math.round(camera.lat * 1e5) / 1e5,
    zoom: Math.round(camera.zoom * 100) / 100,
    pitch: Math.round(camera.pitch),
    bearing: Math.round(camera.bearing),
  };
}

/** Roundtrip: serialize → store → read → restore must give the same camera. */
export function deserializeCamera(raw: unknown): CameraMemory | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const nums = [r.lng, r.lat, r.zoom, r.pitch, r.bearing];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { lng: r.lng as number, lat: r.lat as number, zoom: r.zoom as number, pitch: r.pitch as number, bearing: r.bearing as number };
}

export function sanitizeCameraStore(raw: unknown): CameraMemoryStore {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: CameraMemoryStore = {};
  for (const key of ["full", "compact"] as const) {
    const cam = deserializeCamera(r[key]);
    if (cam) out[key] = serializeCamera(cam);
  }
  return out;
}

// ---- Layer prefs (spec 22) --------------------------------------------------

export type TimeRange = "24h" | "7d" | "30d" | "all";
export type Units = "metric" | "imperial";

export interface MapV4Prefs {
  mode: MapMode;
  exaggeration: TerrainExaggeration;
  layers: {
    incidents: boolean;
    clusters: boolean;
    serviceArea: boolean;
    terrain: boolean;
  };
  timeRange: TimeRange;
  /** Multi-select of real statuses; empty array = show every status. */
  statuses: string[];
}

export const MAP_V4_PREFS_KEY = "map-v4-prefs";

export const DEFAULT_PREFS: MapV4Prefs = {
  mode: "2d",
  exaggeration: "natural",
  layers: { incidents: true, clusters: true, serviceArea: true, terrain: true },
  timeRange: "all",
  statuses: [],
};

const MAP_MODES: MapMode[] = ["2d", "satellite", "terrain"];
const EXAGGERATIONS: TerrainExaggeration[] = ["natural", "enhanced"];
const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d", "all"];

/** Never trust storage: malformed prefs fall back field-by-field to defaults. */
export function sanitizePrefs(raw: unknown): MapV4Prefs {
  const prefs: MapV4Prefs = { ...DEFAULT_PREFS, layers: { ...DEFAULT_PREFS.layers }, statuses: [] };
  if (typeof raw !== "object" || raw === null) return prefs;
  const r = raw as Record<string, unknown>;
  if (typeof r.mode === "string" && (MAP_MODES as string[]).includes(r.mode)) prefs.mode = r.mode as MapMode;
  if (typeof r.exaggeration === "string" && (EXAGGERATIONS as string[]).includes(r.exaggeration)) prefs.exaggeration = r.exaggeration as TerrainExaggeration;
  if (typeof r.timeRange === "string" && (TIME_RANGES as string[]).includes(r.timeRange)) prefs.timeRange = r.timeRange as TimeRange;
  if (typeof r.layers === "object" && r.layers !== null) {
    const l = r.layers as Record<string, unknown>;
    for (const key of ["incidents", "clusters", "serviceArea", "terrain"] as const) {
      if (typeof l[key] === "boolean") prefs.layers[key] = l[key] as boolean;
    }
  }
  if (Array.isArray(r.statuses)) prefs.statuses = r.statuses.filter((s): s is string => typeof s === "string");
  return prefs;
}

// ---- Incident filtering (spec 22) -------------------------------------------

const RANGE_HOURS: Record<Exclude<TimeRange, "all">, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

/** Filter by the incident's own timeline field: occurredAt, falling back to createdAt. */
export function filterByTimeRange(incidents: Incident[], range: TimeRange, now = Date.now()): Incident[] {
  if (range === "all") return incidents;
  const hours = RANGE_HOURS[range];
  const cutoff = now - hours * 3600 * 1000;
  return incidents.filter((i) => {
    const t = i.occurredAt ?? i.createdAt;
    if (!t) return false;
    const ms = Date.parse(t);
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

/** Statuses that actually occur in the dataset, in legend order. */
export function statusesPresent(incidents: Incident[], legendOrder: string[]): string[] {
  const present = new Set<string>(incidents.map((i) => i.status));
  return legendOrder.filter((s) => present.has(s));
}

export function filterByStatuses(incidents: Incident[], selected: string[]): Incident[] {
  if (selected.length === 0) return incidents;
  const set = new Set(selected);
  return incidents.filter((i) => set.has(i.status));
}

// ---- Measure (spec 25) ------------------------------------------------------

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle (haversine) distance in kilometers. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const KM_TO_MI = 0.621371;

/** Field-facing distance string; metric (km) by default, imperial (mi) opt-in. */
export function formatDistance(km: number, units: Units = "metric"): string {
  if (units === "imperial") {
    const mi = km * KM_TO_MI;
    return `${mi < 10 ? mi.toFixed(2) : mi.toFixed(1)} mi`;
  }
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

// ---- Cluster inspector (spec 92) --------------------------------------------

/** Minimal structural point (no mapProvider import → keeps this file dependency-light). */
export interface ClusterMember {
  state: string;
  refId?: number;
}

export interface ClusterSummary {
  count: number;
  states: Record<string, number>;
  /** Oldest member's reference (by occurredAt ?? createdAt) — reference only, no coordinates. */
  oldestReference: string | null;
  /** Members with no open custody entry. */
  unassigned: number;
}

export function isUnassignedIncident(incident: Incident): boolean {
  const hasOpenCustody = incident.custody.some((c) => !c.endedAt);
  // Same rule as the map inspector: a freshly reported case waiting for triage
  // is not considered "assigned", it simply has no holder yet.
  if (incident.status === "reported" || incident.status === "response_requested") return true;
  return !hasOpenCustody;
}

/**
 * Aggregate a clicked cluster into an honest operational summary.
 * `meta` maps a member refId to its incident; members without a resolvable
 * incident are counted but never guessed at.
 */
export function buildClusterSummary(
  members: ClusterMember[],
  meta: (refId: number) => Incident | undefined,
): ClusterSummary {
  const states: Record<string, number> = {};
  let unassigned = 0;
  let oldest: Incident | null = null;
  for (const m of members) {
    states[m.state] = (states[m.state] ?? 0) + 1;
    const incident = m.refId != null ? meta(m.refId) : undefined;
    if (!incident) continue;
    if (isUnassignedIncident(incident)) unassigned += 1;
    const t = Date.parse(incident.occurredAt ?? incident.createdAt ?? "");
    if (Number.isFinite(t) && (oldest === null || t < Date.parse(oldest.occurredAt ?? oldest.createdAt ?? ""))) {
      oldest = incident;
    }
  }
  return {
    count: members.length,
    states,
    oldestReference: oldest?.humanReference ?? null,
    unassigned,
  };
}

// ---- Field lens (spec 90/23) -------------------------------------------------

export interface FieldLens {
  /** Approximate elevation in meters, terrain mode only; null in 2D. */
  elevationM: number | null;
  /** Always false for sensitive incidents — the lens never carries coordinates. */
  includesExactCoordinates: boolean;
  note: string | null;
}

/**
 * The field lens deliberately reports ONLY a coarse elevation. It never
 * echoes back latitude/longitude — for a sensitive incident the marker
 * position is already heavily fuzzed upstream, and the lens output must stay
 * free of any coordinate pair (asserted by v4.test.ts).
 */
export function buildFieldLens(incident: Incident, elevationM: number | null): FieldLens {
  const sensitive = incident.location.precision === "sensitive";
  return {
    elevationM,
    includesExactCoordinates: false,
    note: sensitive ? "sensitive" : null,
  };
}

/** "≈ 412 m" — the tilde is the honesty: DEM tiles are ~30 m resolution. */
export function formatElevation(elevationM: number): string {
  return `≈ ${Math.round(elevationM)} m`;
}
