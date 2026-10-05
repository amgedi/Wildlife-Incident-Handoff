/**
 * MapLibre instance helpers for the field operations map (v4).
 * Every function takes the map explicitly, fails soft (returns false / null
 * instead of throwing), and cleans up exactly what it added (spec 105).
 */
import * as maplibregl from "maplibre-gl";
import { TERRAIN_DEM, TERRAIN_EXAGGERATION, type CameraMemory, type TerrainExaggeration } from "./v4";

const HILLSHADE_LAYER = "mv4-hillshade";

/**
 * Terrain (spec 17): a real raster-dem source (AWS Terrarium) + hillshade +
 * map.setTerrain. Returns false when WebGL/terrain is unavailable or the map
 * rejects the setup — the caller must then fall back to 2D with an honest
 * notice ("Terrain needs an internet connection and WebGL"). Never fakes
 * elevation.
 */
export function enableTerrain(
  map: maplibregl.Map,
  exaggeration: TerrainExaggeration,
  onDemError?: () => void,
): boolean {
  try {
    if (typeof map.setTerrain !== "function") return false;
    if (!map.getSource(TERRAIN_DEM.id)) {
      map.addSource(TERRAIN_DEM.id, {
        type: "raster-dem",
        tiles: TERRAIN_DEM.tiles,
        encoding: TERRAIN_DEM.encoding,
        tileSize: TERRAIN_DEM.tileSize,
        maxzoom: TERRAIN_DEM.maxzoom,
        attribution: TERRAIN_DEM.attribution,
      });
    }
    if (!map.getLayer(HILLSHADE_LAYER)) {
      map.addLayer({ id: HILLSHADE_LAYER, type: "hillshade", source: TERRAIN_DEM.id, paint: { "hillshade-exaggeration": 0.35 } });
    }
    map.setTerrain({ source: TERRAIN_DEM.id, exaggeration: TERRAIN_EXAGGERATION[exaggeration] });
    if (onDemError) {
      const handler = (e: unknown) => {
        const sourceId = (e as { sourceId?: string } | undefined)?.sourceId;
        if (sourceId === TERRAIN_DEM.id) onDemError();
      };
      map.off("error", handler);
      map.on("error", handler);
    }
    return true;
  } catch {
    return false;
  }
}

/** Leave 3D: drop the terrain and the hillshade layer; the DEM source stays
 *  only while needed — removed here so destroy() adds nothing extra. */
export function disableTerrain(map: maplibregl.Map): void {
  try {
    map.setTerrain(null);
    if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
    if (map.getSource(TERRAIN_DEM.id)) map.removeSource(TERRAIN_DEM.id);
  } catch { /* style already gone */ }
}

// ---- Measure (spec 25) ------------------------------------------------------

const MEASURE_SOURCE = "mv4-measure";
const MEASURE_LINE = "mv4-measure-line";

// ---- Camera (spec 99/100) ---------------------------------------------------

export function captureCamera(map: maplibregl.Map): CameraMemory | null {
  try {
    return {
      lng: map.getCenter().lng,
      lat: map.getCenter().lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    };
  } catch {
    return null;
  }
}

/** Compass V5 (spec 39): animate bearing to north; pitch is left alone —
 *  terrain tilt is a deliberate user choice managed by the tilt control. */
export function resetCompass(map: maplibregl.Map): void {
  try {
    map.easeTo({ bearing: 0, duration: 350 });
  } catch { /* map gone */ }
}

/** Terrain tilt control (spec 40): animate pitch to the requested angle. */
export function easePitch(map: maplibregl.Map, pitch: number): void {
  try {
    map.easeTo({ pitch, duration: 450 });
  } catch { /* map gone */ }
}

function measurePinElement(letter: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = [
    "display:flex", "align-items:center", "justify-content:center",
    "width:26px", "height:36px", "pointer-events:none",
    "filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.45))",
  ].join(";");
  el.innerHTML =
    '<svg width="26" height="36" viewBox="0 0 26 36">' +
    '<path d="M13 1C6.9 1 2 5.9 2 12c0 7.4 9.4 21.3 10.3 22.5a0.9 0.9 0 0 0 1.4 0C14.6 33.3 24 19.4 24 12 24 5.9 19.1 1 13 1Z" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>' +
    `<text x="13" y="16.5" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2937" font-family="inherit">${letter}</text>` +
    "</svg>";
  return el;
}

/**
 * Measure V5 (spec 41/42): the distance line plus designed A/B map pins
 * (theme-aware amber handles, not generic dots). null clears everything.
 */
export function setMeasureLine(map: maplibregl.Map, coords: [number, number][] | null): void {
  try {
    // Remove any previous pins first — they live outside the style.
    const m = map as unknown as { __mv4MeasurePins?: maplibregl.Marker[] };
    for (const pin of m.__mv4MeasurePins ?? []) pin.remove();
    m.__mv4MeasurePins = [];
    if (!coords || coords.length === 0) {
      if (map.getLayer(MEASURE_LINE)) map.removeLayer(MEASURE_LINE);
      if (map.getSource(MEASURE_SOURCE)) map.removeSource(MEASURE_SOURCE);
      return;
    }
    const pins: maplibregl.Marker[] = [];
    coords.forEach((c, i) => {
      const marker = new maplibregl.Marker({ element: measurePinElement(i === 0 ? "A" : "B"), anchor: "bottom" })
        .setLngLat(c)
        .addTo(map);
      pins.push(marker);
    });
    m.__mv4MeasurePins = pins;
    if (coords.length < 2) {
      if (map.getLayer(MEASURE_LINE)) map.removeLayer(MEASURE_LINE);
      if (map.getSource(MEASURE_SOURCE)) map.removeSource(MEASURE_SOURCE);
      return;
    }
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: coords },
    };
    const source = map.getSource(MEASURE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else {
      map.addSource(MEASURE_SOURCE, { type: "geojson", data });
      map.addLayer({
        id: MEASURE_LINE,
        type: "line",
        source: MEASURE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f59e0b", "line-width": 2.5, "line-dasharray": [1.5, 1.5] },
      });
    }
  } catch { /* style swapped mid-measure */ }
}

/**
 * Field lens elevation (spec 90/23). queryTerrainElevation is only available
 * with an active DEM and returns meters; any failure → null, and the caller
 * omits the reading in 2D. Wrapped so a missing API can never break the UI.
 */
export function queryElevationM(map: maplibregl.Map, lng: number, lat: number): number | null {
  try {
    const q = (map as unknown as { queryTerrainElevation?: (lngLat: [number, number]) => number | null }).queryTerrainElevation;
    if (typeof q !== "function") return null;
    const value = q.call(map, [lng, lat]);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
