/**
 * Map privacy helpers + MapLibre provider.
 *
 * Privacy rules (network map):
 *  - EXACT: authorized responder context — show the real marker position.
 *  - APPROXIMATE: coordinates are fuzzed to a ~1km grid before rendering.
 *  - SENSITIVE: no precise marker — only the general area is shown, and the
 *    exact coordinates are never placed in the DOM or map data.
 * The app never sends coordinates anywhere except to the chosen tile server
 * (OpenStreetMap raster tiles, no API key) for background imagery.
 */
import * as maplibregl from "maplibre-gl";
import type { Incident } from "../../types/incident";
import type { MapProvider } from "./networkService";
import { feedGroupFor } from "./networkService";

export type MapPrivacy = "exact" | "approximate" | "sensitive";

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

/**
 * MapLibre-based provider using OpenStreetMap raster tiles (no API key,
 * attribution required). Fully swappable via the MapProvider interface.
 */
export function createMapLibreProvider(): MapProvider & { destroy(): void; setErrorHandler(fn: (offline: boolean) => void): void } {
  let map: maplibregl.Map | null = null;
  let markers: maplibregl.Marker[] = [];
  let errorFn: ((offline: boolean) => void) | null = null;

  return {
    id: "maplibre-osm",
    setErrorHandler(fn) {
      errorFn = fn;
    },
    renderMarkers(container, points) {
      if (map) {
        markers.forEach((m) => m.remove());
        markers = [];
        updatePoints(points);
        return;
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
        center: points.length > 0 ? [points[0]!.lon, points[0]!.lat] : [0, 20],
        zoom: points.length > 0 ? 10 : 1,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      map.on("error", (_e: unknown) => errorFn?.(true));
      map.on("data", (e) => {
        if (e.dataType === "source" && errorFn) errorFn(false);
      });
      map.on("load", () => updatePoints(points));
      function updatePoints(pts: typeof points) {
        if (!map) return;
        markers.forEach((m) => m.remove());
        markers = pts.map((p) => {
          const el = document.createElement("div");
          el.className = "map-marker";
          el.dataset.state = p.state;
          el.title = p.label;
          el.innerHTML = `<span class="map-marker-shape">${STATUS_MARKER_SHAPES[p.state] ?? "●"}</span>`;
          return new maplibregl.Marker({ element: el })
            .setLngLat([p.lon, p.lat])
            .addTo(map!);
        });
      }
    },
    destroy() {
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
      map = null;
    },
  };
}
