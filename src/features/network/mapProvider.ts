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

/**
 * dev.18 — the incident's OWN declared location precision always wins over
 * the view-level default. A "sensitive" incident must never render at the
 * approximate fuzz level just because the surrounding view defaults to
 * approximate. View privacy is only a fallback for legacy records with no
 * stored precision.
 */
export function effectivePrivacy(incident: Incident, viewPrivacy: MapPrivacy): MapPrivacy {
  return incident.location.precision ?? viewPrivacy;
}

/**
 * Per-status marker styles (dev.17): every incident status has its own
 * high-contrast color + glyph so markers stay readable on satellite imagery
 * and status is never conveyed by color alone (shape/letter is in the marker).
 */
export const STATUS_MARKER_STYLES: Record<string, { color: string; glyph: string; label: string }> = {
  reported: { color: "#2563eb", glyph: "●", label: "Reported" },
  response_requested: { color: "#0891b2", glyph: "●", label: "Response requested" },
  responder_assigned: { color: "#7c3aed", glyph: "◆", label: "Responder assigned" },
  awaiting_pickup: { color: "#d97706", glyph: "▲", label: "Awaiting pickup" },
  in_transport: { color: "#ea580c", glyph: "➜", label: "In transport" },
  transferred: { color: "#0d9488", glyph: "⇄", label: "Transferred" },
  in_care: { color: "#16a34a", glyph: "♥", label: "In care" },
  veterinary_care: { color: "#15803d", glyph: "+", label: "Veterinary care" },
  monitoring: { color: "#65a30d", glyph: "◐", label: "Monitoring" },
  released: { color: "#22c55e", glyph: "✓", label: "Released" },
  deceased: { color: "#374151", glyph: "✕", label: "Deceased" },
  closed: { color: "#6b7280", glyph: "■", label: "Closed" },
  cancelled: { color: "#9ca3af", glyph: "×", label: "Cancelled" },
};

/** Backwards-compatible group colors (legend fallbacks). */
export const STATUS_MARKER_COLORS: Record<string, string> = {
  new: "#2563eb",
  active: "#7c3aed",
  transfer: "#0d9488",
  closed: "#6b7280",
};

/** Shapes are paired with colors so status is not color alone. */
export const STATUS_MARKER_SHAPES: Record<string, string> = {
  new: "●", // circle
  active: "▲", // triangle
  transfer: "◆", // diamond
  closed: "■", // square
};

/** Inline style for a map marker element: large, white-ringed, per-status. */
export function markerElementStyle(state: string): string {
  const style = STATUS_MARKER_STYLES[state] ?? { color: "#2563eb" };
  return [
    "width:28px", "height:28px", "border-radius:50%",
    `background:${style.color}`,
    "border:2.5px solid #ffffff",
    "box-shadow:0 1px 6px rgb(0 0 0 / 0.5)",
    "display:flex", "align-items:center", "justify-content:center",
    "color:#ffffff", "font-size:14px", "font-weight:700", "line-height:1",
    "cursor:pointer",
  ].join(";");
}

/** Marker state = the incident's real status (per-status colors, dev.17). */
export function markerStateFor(incident: Incident): string {
  return incident.status;
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

// ---- Provider registry (P18: no single hard-coded provider) ----------------

/**
 * Declarative tile-provider descriptors. Adding a provider means adding one
 * entry here — no changes to the MapLibre wiring. `kind: "offline"` providers
 * declare no tile URLs: MapLibre renders a plain background layer and the
 * browser makes zero network requests.
 */
export interface MapProviderDescriptor {
  id: string;
  label: string;
  kind: "raster-tiles" | "offline";
  tiles: string[];
  attribution: string;
  maxZoom: number;
  requiresNetwork: boolean;
  /** Honest usage-policy note surfaced in Settings → Map (non-sensitive). */
  usageNote: string;
  /** Single polite probe URL for the connection test (null = no probe). */
  healthCheckUrl: string | null;
}

export const MAP_PROVIDERS: MapProviderDescriptor[] = [
  {
    id: "esri-satellite",
    label: "Satellite imagery (Esri World Imagery)",
    kind: "raster-tiles",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Imagery \u00a9 Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
    requiresNetwork: true,
    usageNote:
      "Real-world satellite imagery for operational context. The app only requests viewport tiles and never uploads incident data.",
    healthCheckUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0",
  },
  {
    id: "osm-raster",
    label: "OpenStreetMap raster tiles",
    kind: "raster-tiles",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    requiresNetwork: true,
    usageNote:
      "Public community infrastructure — the app only requests viewport tiles, never uploads incident data, and falls back to the offline provider instead of retrying aggressively.",
    healthCheckUrl: "https://tile.openstreetmap.org/0/0/0.png",
  },
  {
    id: "offline-basemap",
    label: "Offline basemap (no tile requests)",
    kind: "offline",
    tiles: [],
    attribution: "",
    maxZoom: 22,
    requiresNetwork: false,
    usageNote: "Renders markers over a plain background entirely on this device. No network requests are made.",
    healthCheckUrl: null,
  },
];

export function getMapProviderDescriptor(id: string | null | undefined): MapProviderDescriptor {
  return MAP_PROVIDERS.find((p) => p.id === id) ?? MAP_PROVIDERS[0]!;
}

export function listMapProviderDescriptors(): MapProviderDescriptor[] {
  return MAP_PROVIDERS;
}

/** Build a MapLibre style object from a provider descriptor. */
export function styleForProvider(provider: MapProviderDescriptor): maplibregl.StyleSpecification {
  if (provider.kind === "offline" || provider.tiles.length === 0) {
    // Theme-aware background so the offline basemap never looks like a color island.
    const cssBackground = getComputedStyle(document.documentElement).getPropertyValue("--c-surface-alt").trim();
    return {
      version: 8,
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": cssBackground || "#3b4252" } }],
    };
  }
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: provider.tiles,
        tileSize: 256,
        maxzoom: provider.maxZoom,
        attribution: provider.attribution,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

export interface MapPoint {
  lat: number;
  lon: number;
  state: string;
  label: string;
  /** Stable index into the caller's incident array, so click handlers survive marker re-creation. */
  refId?: number;
}

const CLUSTER_MAX_ZOOM = 7; // wider than this → cluster

/** Approximate geodesic circle polygon for the service area (P16: make the area visible). */
export function serviceAreaPolygon(centerLat: number, centerLon: number, radiusKm: number, segments = 72): [number, number][] {
  const latDeg = radiusKm / 110.574;
  const lonDeg = radiusKm / (111.32 * Math.max(0.2, Math.cos((centerLat * Math.PI) / 180)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([centerLon + Math.cos(a) * lonDeg, centerLat + Math.sin(a) * latDeg]);
  }
  return ring;
}

/** Grid-cluster points for the current zoom (P35). Pure function → testable.
 *  Above 120 points clustering also applies close up, keeping the marker DOM
 *  bounded for very large local datasets (perf pass, 1000-incident test). */
const DENSE_POINT_COUNT = 120;

export function clusterPoints(points: MapPoint[], zoom: number, bounds: { north: number; south: number; east: number; west: number }): Array<{ lat: number; lon: number; count: number; states: Record<string, number> }> {
  if (points.length === 0) return [];
  const dense = points.length > DENSE_POINT_COUNT;
  if (zoom > CLUSTER_MAX_ZOOM && !dense) return [];
  const subdivisions = dense ? Math.min(24, Math.ceil(Math.sqrt(points.length))) : 8;
  const cells = new Map<string, { lat: number; lon: number; count: number; states: Record<string, number> }>();
  const latStep = Math.max(0.001, (bounds.north - bounds.south) / subdivisions);
  const lonStep = Math.max(0.001, (bounds.east - bounds.west) / subdivisions);
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
  // Only cluster when it actually reduces marker count meaningfully —
  // except for dense datasets, where bounding the marker DOM is the goal.
  const list = [...cells.values()];
  if (dense) return list;
  return list.length < points.length / 2 ? list : [];
}

export function createMapLibreProvider(options?: {
  serviceArea?: MapServiceArea | null;
  fitMode?: "service-area" | "points";
  providerId?: string | null;
}): MapProvider & {
  destroy(): void;
  setErrorHandler(fn: (offline: boolean) => void): void;
  setLoadHandler(fn: () => void): void;
  setSelectHandler(fn: (point: MapPoint) => void): void;
} {
  let map: maplibregl.Map | null = null;
  let markers: maplibregl.Marker[] = [];
  let errorFn: ((offline: boolean) => void) | null = null;
  let loadFn: (() => void) | null = null;
  let selectFn: ((point: MapPoint) => void) | null = null;
  let currentPoints: MapPoint[] = [];
  let areaLayersAdded = false;
  // 0.3.0-dev.3 MAP LOAD BUG ROOT CAUSE: the map could be initialized while
  // its container was still 0-sized (lazy route mount / tab switch), and
  // nothing resized it after layout settled — the canvas stayed blank until
  // the basemap toggle recreated the style. A ResizeObserver + load-time
  // resize + bounded style retry make recovery automatic.
  let containerObserver: ResizeObserver | null = null;
  let styleLoaded = false;
  let styleRetryDone = false;
  const serviceArea = options?.serviceArea ?? null;
  const providerDescriptor = getMapProviderDescriptor(options?.providerId);
  return {
    id: providerDescriptor.id,
    descriptor: providerDescriptor,
    setErrorHandler(fn) {
      errorFn = fn;
    },
    setLoadHandler(fn) {
      loadFn = fn;
    },
    setSelectHandler(fn) {
      selectFn = fn;
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
        style: styleForProvider(providerDescriptor),
        center,
        zoom,
      });
      styleLoaded = false;
      styleRetryDone = false;
      // Any size change of the container (route mount settling, sidebar
      // collapse, window resize, inspector opening, DPI/zoom change) now
      // resizes the canvas automatically.
      containerObserver?.disconnect();
      containerObserver = new ResizeObserver(() => {
        // ResizeObserver fires before first paint sometimes; guard on map.
        try { map?.resize(); } catch { /* map already destroyed */ }
      });
      containerObserver.observe(container);
      // Attribution comes from the style source (descriptor) — MapLibre renders
      // it with its default attribution control; adding another duplicates it.
      const mapRef = map;
      map.on("error", (e: unknown) => {
        recordMapError((e as { error?: unknown })?.error ?? e);
        // Bounded auto-recovery: if the STYLE itself failed before ever
        // loading, rebuild it once. Tile-level errors still surface the
        // error state via errorFn (retryable in the UI) but do not rebuild.
        if (!styleLoaded && !styleRetryDone) {
          styleRetryDone = true;
          try {
            mapRef.setStyle(styleForProvider(providerDescriptor));
          } catch { /* surfaced via errorFn */ }
        }
        errorFn?.(true);
      });
      map.on("data", (e) => {
        if (e.dataType === "source" && errorFn) errorFn(false);
      });
      map.on("load", () => {
        styleLoaded = true;
        // The style is ready but the canvas may still be stale-sized if the
        // container settled between creation and load — resize once more.
        try { mapRef.resize(); } catch { /* destroyed */ }
        addServiceAreaLayers();
        updatePoints();
        loadFn?.();
      });
      // Overlay must track size changes too — a resize without a camera move
      // used to leave stale/empty markers (documented failure mode #2/#3).
      map.on("resize", () => updatePoints());
      // Belt-and-braces: schedule a first render so a missed load event can
      // never leave the overlay empty.
      requestAnimationFrame(() => updatePoints());
      // Re-cluster as the user zooms.
      map.on("moveend", () => updatePoints());
    },
    destroy() {
      containerObserver?.disconnect();
      containerObserver = null;
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
      map = null;
    },
  };

  function addServiceAreaLayers() {
    if (!map || !serviceArea || serviceArea.centerLat == null || serviceArea.centerLon == null || areaLayersAdded) return;
    areaLayersAdded = true;
    const ring = serviceAreaPolygon(serviceArea.centerLat, serviceArea.centerLon, serviceArea.radiusKm);
    map.addSource("service-area", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } } });
    map.addLayer({
      id: "service-area-fill",
      type: "fill",
      source: "service-area",
      paint: { "fill-color": "#2e7d5b", "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "service-area-line",
      type: "line",
      source: "service-area",
      paint: { "line-color": "#2e7d5b", "line-width": 1.5, "line-opacity": 0.55, "line-dasharray": [2, 2] },
    });
  }

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
        if (c.count === 1) {
          const p = currentPoints.find((pt) => Math.abs(pt.lat - c.lat) < 1e-9 && Math.abs(pt.lon - c.lon) < 1e-9);
          if (p) {
            const el = document.createElement("div");
            el.className = "map-marker";
            el.dataset.state = p.state;
            el.title = p.label;
            el.style.cssText = markerElementStyle(p.state);
            el.textContent = STATUS_MARKER_STYLES[p.state]?.glyph ?? "●";
            if (selectFn) el.addEventListener("click", (ev) => { ev.stopPropagation(); selectFn?.(p); });
            markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
          }
          continue;
        }
        const el = document.createElement("div");
        el.className = "map-cluster";
        el.style.cssText = "width:34px;height:34px;border-radius:50%;background:rgba(20,60,40,0.92);border:2.5px solid #ffffff;box-shadow:0 1px 6px rgb(0 0 0 / 0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;cursor:pointer";
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
      el.style.cssText = markerElementStyle(p.state);
      el.textContent = STATUS_MARKER_STYLES[p.state]?.glyph ?? STATUS_MARKER_SHAPES[p.state] ?? "●";
      if (selectFn) {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          selectFn?.(p);
        });
      }
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    }
  }
}
