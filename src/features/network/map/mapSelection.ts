/**
 * Map selection camera logic (0.3.0-dev.7 Part XII–XIV).
 *
 * Single-clicking a list row shows THAT incident on the map: select its
 * marker, move the camera, open the inspector — and never leave the Map page.
 * Opening the full record is a separate explicit action (double-click /
 * "Open incident"). The camera target is always the SAME privacy-safe
 * position the visible marker uses, so selection can never reveal hidden
 * coordinates.
 *
 * Pure functions only — unit-testable without a map instance.
 */

export interface MapPointLike {
  lat: number;
  lon: number;
}

export interface ViewBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CameraDecision {
  /** "ease": the marker is already in view — a small pan only.
   *  "fly": the marker is far away — smooth flyTo. */
  mode: "ease" | "fly";
  /** Only set for "fly": the zoom to arrive at. Chosen to expand a cluster
   *  so the individual marker becomes visible where possible, without
   *  zooming absurdly close. */
  zoom?: number;
}

/** Marker-in-view margin as a fraction of the viewport span. */
const EDGE_MARGIN = 0.1;
/** Camera zoom used when flying to a selected incident. High enough to break
 *  most clusters (grid clustering is wide-zoom only at CLUSTER_MAX_ZOOM = 7,
 *  plus dense-data close-up clustering), low enough to keep context. */
const FLY_ZOOM = 12.5;
const FLY_ZOOM_MAX = 13.5;

/**
 * Decide how the camera should move to show a selected incident.
 * Never changes privacy semantics: callers pass the fuzzed/generalized
 * position that the marker already uses.
 */
export function selectionCameraDecision(
  point: MapPointLike,
  bounds: ViewBounds,
  currentZoom: number,
): CameraDecision {
  const latSpan = bounds.north - bounds.south;
  const lonSpan = bounds.east - bounds.west;
  // Degenerate/unknown bounds → treat as far away.
  if (!Number.isFinite(latSpan) || !Number.isFinite(lonSpan) || latSpan <= 0 || lonSpan <= 0) {
    return { mode: "fly", zoom: FLY_ZOOM };
  }
  const latMargin = latSpan * EDGE_MARGIN;
  const lonMargin = lonSpan * EDGE_MARGIN;
  const visible =
    point.lat >= bounds.south + latMargin &&
    point.lat <= bounds.north - latMargin &&
    point.lon >= bounds.west + lonMargin &&
    point.lon <= bounds.east - lonMargin;
  if (visible) {
    // Small pan only — keep the user's zoom (spec 47).
    return { mode: "ease" };
  }
  // Far away: fly, but never zoom OUT below the current zoom and never
  // past the ceiling (spec 47: reasonable zoom, not absurdly close).
  const zoom = Math.min(Math.max(currentZoom, FLY_ZOOM), FLY_ZOOM_MAX);
  return { mode: "fly", zoom };
}

/** Zoom at/above which an individually-rendered marker is expected to be
 *  visible even in dense-data close-up clustering. Selection from the list
 *  uses at least this zoom when the point is not currently visible. */
export const SELECTION_MIN_ZOOM = FLY_ZOOM;
