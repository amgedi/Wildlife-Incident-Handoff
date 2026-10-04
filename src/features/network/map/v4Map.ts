/**
 * MapLibre instance helpers for the field operations map (v4).
 * Every function takes the map explicitly, fails soft (returns false / null
 * instead of throwing), and cleans up exactly what it added (spec 105).
 */
import type * as maplibregl from "maplibre-gl";
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

/**
 * Draw the great-circle-ish measure line between 1–2 clicked points (max 2).
 * null clears the layer entirely — no stale geometry is left behind.
 */
export function setMeasureLine(map: maplibregl.Map, coords: [number, number][] | null): void {
  try {
    if (!coords || coords.length < 2) {
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

/** Compass (spec 100): level the view — bearing 0 + pitch 0, smooth. */
export function resetCompass(map: maplibregl.Map): void {
  try {
    map.easeTo({ bearing: 0, pitch: 0, duration: 350 });
  } catch { /* map gone */ }
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
