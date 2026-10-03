/**
 * Map privacy helpers + MapLibre provider (0.2.0-dev.8).
 *
 * Privacy rules (network map):
 *  - EXACT: authorized responder context — show the real marker position.
 *  - APPROXIMATE: coordinates are fuzzed to a ~1km grid before rendering.
 *  - SENSITIVE: no precise marker — only the general area is shown, and the
 *    exact coordinates are never placed in the DOM or map data.
 * The app never sends coordinates anywhere except to the chosen tile server
 * (OpenStreetMap raster tiles, no API key) for background imagery.
 *
 * dev.8 additions:
 *  - Service-area first: the camera fits the configured service area (or the
 *    incident cluster), never the whole world (P31/P34).
 *  - Client-side grid clustering at wide zooms (P35): markers group into
 *    count badges; clicking a cluster zooms in.
 *  - Non-sensitive failure diagnostics (P37): the last tile/network error
 *    class is recorded (never coordinates) and surfaced in Settings → Map.
 */
import * as maplibregl from "maplibre-gl";
import type { Incident } from "../../types/incident";
import type { MapProvider } from "./networkService";
import { feedGroupFor } from "./networkService";

export type MapPrivacy = "exact" | "approximate" | "sensitive";

export interface MapServiceArea {
  centerLat: number | null;
  centerLon: number | null;
  radiusKm: number;
  label?: string;
}

/** Deterministically fuzz coordinates to ~0.01° (~1 km) grid. */
export function fuzzCoordinates(lat: number, lon: number): { lat: number; lon: number } {
  const grid = 0.01;
  const jitterSeed = Math.abs(Math.sin(lat * 1000 + lon * 1000)) * grid;
  return {
    lat: Math.round((lat + jitterSeed - grid / 2) / grid) * grid,
    lon: Math.round((lon + jitterSeed - grid / 2) / grid) * grid,
  };
}

/** Marker coordinates honoring privacy; null = do not place a marker. */
export function markerPositionFor(incident: Incident, privacy: MapPrivacy): { lat: number; lon: number } | null {
  const { latitude, longitude } = incident.location;
  if (latitude == null || longitude == null) return null;
  if (privacy === "sensitive") {
    // Show only a heavily fuzzed location (~10 km) — never the real point.
    return fuzzCoordinates(latitude / 10, longitude / 10);
  }
  if (privacy === "approximate") return fuzzCoordinates(latitude, longitude);
  return { lat: latitude, lon: longitude };
}

export const STATUS_MARKER_COLORS: Record<string, string> = {
  new: "#2b6cb0",
  active: "#553c9a",
  transfer: "#0e7f8c",
  closed: "#595f6d",
};

/** Shapes are paired with colors so status is not color alone. */
export const STATUS_MARKER_SHAPES: Record<string, string> = {
  new: "●", // circle
  active: "▲", // triangle
  transfer: "◆", // diamond
  closed: "■", // square
};

export function markerStateFor(incident: Incident): keyof typeof STATUS_MARKER_COLORS {
  return feedGroupFor(incident) as keyof typeof STATUS_MARKER_COLORS;
}

// ---- Non-sensitive diagnostics (P37) --------------------------------------

export interface MapDiagnostics {
  lastErrorClass: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
}

let diagnostics: MapDiagnostics = { lastErrorClass: null, lastErrorMessage: null, lastErrorAt: null };

/** Non-sensitive: HTTP status or error class only — never coordinates,
 *  URLs with query data, or anything incident-related. */
export function getMapDiagnostics(): MapDiagnostics {
  return { ...diagnostics };
}

function recordMapError(err: unknown): void {
  let cls = "tile-error";
  let msg: string | null = null;
  const anyErr = err as { status?: number; message?: string } | undefined;
  if (anyErr && typeof anyErr.status === "number") {
    cls = `HTTP ${anyErr.status}`;
    if (anyErr.status === 429) msg = "Rate limited by the tile provider (HTTP 429)";
    else if (anyErr.status === 403) msg = "Blocked by the tile provider (HTTP 403) — usage policy";
    else if (anyErr.status === 404) msg = "Tile not found (HTTP 404)";
    else msg = `Tile request failed (HTTP ${anyErr.status})`;
  } else if (anyErr && typeof anyErr.message === "string" && anyErr.message) {
    msg = anyErr.message.slice(0, 120);
  }
  diagnostics = { lastErrorClass: cls, lastErrorMessage: msg, lastErrorAt: new Date().toISOString() };
}

export function resetMapDiagnostics(): void {
  diagnostics = { lastErrorClass: null, lastErrorMessage: null, lastErrorAt: null };
}

// ---- Provider --------------------------------------------------------------

export interface MapPoint {
  lat: number;
  lon: number;
  state: string;
  label: string;
}

const CLUSTER_MAX_ZOOM = 7; // wider than this → cluster

/** Grid-cluster points for the current zoom (P35). Pure function → testable. */
export function clusterPoints(points: MapPoint[], zoom: number, bounds: { north: number; south: number; east: number; west: number }): Array<{ lat: number; lon: number; count: number; states: Record<string, number> }> {
  if (zoom > CLUSTER_MAX_ZOOM || points.length === 0) return [];
  const cells = new Map<string, { lat: number; lon: number; count: number; states: Record<string, number> }>();
  const latStep = Math.max(0.05, (bounds.north - bounds.south) / 8);
  const lonStep = Math.max(0.05, (bounds.east - bounds.west) / 8);
  for (const p of points) {
    const key = `${Math.floor(p.lat / latStep)}:${Math.floor(p.lon / lonStep)}`;
    const cell = cells.get(key);
    if (cell) {
      cell.count += 1;
      cell.states[p.state] = (cell.states[p.state] ?? 0) + 1;
      cell.lat = (cell.lat * (cell.count - 1) + p.lat) / cell.count;
      cell.lon = (cell.lon * (cell.count - 1) + p.lon) / cell.count;
    } else {
      cells.set(key, { lat: p.lat, lon: p.lon, count: 1, states: { [p.state]: 1 } });
    }
  }
  // Only cluster when it actually reduces marker count meaningfully.
  const list = [...cells.values()];
  return list.length < points.length / 2 ? list : [];
}

export function createMapLibreProvider(options?: { serviceArea?: MapServiceArea | null; fitMode?: "service-area" | "points" }): MapProvider & {
  destroy(): void;
  setErrorHandler(fn: (offline: boolean) => void): void;
  setLoadHandler(fn: () => void): void;
} {
  let map: maplibregl.Map | null = null;
  let markers: maplibregl.Marker[] = [];
  let errorFn: ((offline: boolean) => void) | null = null;
  let loadFn: (() => void) | null = null;
  let currentPoints: MapPoint[] = [];
  const serviceArea = options?.serviceArea ?? null;


  return {
    id: "maplibre-osm",
    setErrorHandler(fn) {
      errorFn = fn;
    },
    setLoadHandler(fn) {
      loadFn = fn;
    },
    renderMarkers(container, points) {
      currentPoints = points;
      if (map) {
        markers.forEach((m) => m.remove());
        markers = [];
        updatePoints();
        return;
      }
      // P31/P34 — camera starts on the user's operational area, not the world.
      let center: [number, number] = [0, 20];
      let zoom = 2;
      if (serviceArea?.centerLat != null && serviceArea.centerLon != null) {
        center = [serviceArea.centerLon, serviceArea.centerLat];
        // Approximate zoom so the radius circle fits: zoom ≈ log2(360 / degreesSpan).
        const latDegPerKm = 1 / 110.574;
        const spanDeg = Math.max(0.05, serviceArea.radiusKm * 2 * latDegPerKm * 1.6);
        zoom = Math.min(14, Math.max(2, Math.log2(360 / spanDeg)));
      } else if (points.length > 0) {
        const lats = points.map((p) => p.lat);
        const lons = points.map((p) => p.lon);
        center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
        const spanDeg = Math.max(0.02, Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons)) * 1.8);
        zoom = Math.min(14, Math.max(2, Math.log2(360 / spanDeg)));
      }
      map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center,
        zoom,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      map.on("error", (e: unknown) => {
        recordMapError((e as { error?: unknown })?.error ?? e);
        errorFn?.(true);
      });
      map.on("data", (e) => {
        if (e.dataType === "source" && errorFn) errorFn(false);
      });
      map.on("load", () => {
        updatePoints();
        loadFn?.();
      });
      // Re-cluster as the user zooms.
      map.on("moveend", () => updatePoints());
    },
    destroy() {
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
      map = null;
    },
  };

  function updatePoints() {
    if (!map) return;
    markers.forEach((m) => m.remove());
    markers = [];
    const zoom = map.getZoom();
    const b = map.getBounds();
    const clusters = clusterPoints(currentPoints, zoom, {
      north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(),
    });
    if (clusters.length > 0) {
      for (const c of clusters) {
        if (!c) continue;
        const el = document.createElement("div");
        el.className = "map-cluster";
        const dominant = Object.entries(c.states).sort((a, b2) => b2[1] - a[1])[0]?.[0] ?? "new";
        el.dataset.state = dominant;
        el.title = `${c.count} incidents — zoom in to see them`;
        el.innerHTML = `<span class="map-cluster-count">${c.count}</span>`;
        el.addEventListener("click", () => {
          map?.easeTo({ center: [c.lon, c.lat], zoom: (map?.getZoom() ?? 4) + 2.5 });
        });
        markers.push(new maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(map));
      }
      return;
    }
    for (const p of currentPoints) {
      const el = document.createElement("div");
      el.className = "map-marker";
      el.dataset.state = p.state;
      el.title = p.label;
      el.innerHTML = `<span class="map-marker-shape">${STATUS_MARKER_SHAPES[p.state] ?? "●"}</span>`;
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    }
  }
}
