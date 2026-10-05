/** React wrapper for the MapLibre provider (network map + dashboard panel). */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { MapMouseEvent } from "maplibre-gl";
import type { Incident } from "../../types/incident";
import { createMapLibreProvider, markerPositionFor, markerStateFor, STATUS_MARKER_STYLES, getMapDiagnostics, effectivePrivacy, type MapPrivacy, type MapServiceArea } from "./mapProvider";
import { resolveGeocodeTarget, reverseGeocode, getExactGeocodeConsent, setExactGeocodeConsent, getActiveGeocodingProvider, peekGeocodeCache } from "./geocoding";
import { fuzzCoordinates } from "./mapProvider";
import { animalLabel } from "../export/exportService";
import { Icons } from "../../components/Icons";
import { StatusBadge } from "../../components/ui";
import { relativeTime } from "../../utils/time";
import { getSetting, setSetting } from "../../storage/repositories";
import {
  buildClusterSummary, buildFieldLens, CAMERA_MEMORY_KEY, DEFAULT_PREFS, filterByStatuses, filterByTimeRange,
  formatDistance, formatElevation, greatCircleKm, MAP_V4_PREFS_KEY, providerIdForMode, sanitizeCameraStore,
  sanitizePrefs, statusesPresent, serializeCamera, TERRAIN_PITCH,
  type CameraMemoryStore, type ClusterSummary, type MapV4Prefs, type Units,
} from "./map/v4";
import { disableTerrain, easePitch, enableTerrain, queryElevationM, resetCompass, setMeasureLine } from "./map/v4Map";
import { selectionCameraDecision } from "./map/mapSelection";
import { CONCERN_TYPES } from "../incidents/concernTypes";
import { BookmarkButton } from "../incidents/BookmarkButton";

type MapState = "loading" | "ready" | "offline" | "provider-failed" | "no-coordinates";

/**
 * Map sizing: every mode uses an explicit pixel/viewport height. A
 * percentage height against an auto-height parent resolves to 0 and
 * produced the long-running "blank desktop map" failure (see
 * docs/MAP_FAILURE_ANALYSIS.md).
 */
function heightFor(mode: "compact" | "standard" | "full"): string {
  if (mode === "compact") return "380px";
  if (mode === "full") return "calc(100dvh - 240px)";
  return "460px";
}

export function NetworkMap({
  incidents,
  privacy,
  onSelect,
  compact = false,
  serviceArea = null,
  fitMode = "points",
  full = false,
  offline = false,
  units = "metric",
  selectedId = undefined,
  onSelectedChange,
}: {
  incidents: Incident[];
  privacy: MapPrivacy;
  onSelect?: (incident: Incident) => void;
  /** Compact dashboard panel: reduced default height. */
  compact?: boolean;
  /** P31/P34: fit the camera to the service area instead of the world. */
  serviceArea?: MapServiceArea | null;
  fitMode?: "service-area" | "points";
  /** Full map destination: fills the workspace. */
  full?: boolean;
  /** Offline provider: plain device-rendered basemap, zero tile requests (P18/P19). */
  offline?: boolean;
  /** v4 (spec 25): measure distance unit. Metric (km) by default. */
  units?: Units;
  /** 0.3.0-dev.7 (Part XII): controlled selection — the map-side list sets
   *  this to select + fly to an incident WITHOUT navigating away. */
  selectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
}) {
  const { t } = useTranslation("professional");
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>(() => (incidents.length === 0 ? "no-coordinates" : "loading"));
  const [retryToken, setRetryToken] = useState(0);
  const [inspected, setInspected] = useState<number | null>(null);
  const providerRef = useRef<ReturnType<typeof createMapLibreProvider> | null>(null);

  // ---- v4 field-operations state -------------------------------------------
  const [prefs, setPrefs] = useState<MapV4Prefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [terrainFailed, setTerrainFailed] = useState(false);
  const [terrainActive, setTerrainActive] = useState(false);
  const [terrainAttempt, setTerrainAttempt] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
  const [cluster, setCluster] = useState<{ summary: ClusterSummary; bounds: [[number, number], [number, number]] } | null>(null);
  const [view, setView] = useState({ bearing: 0, pitch: 0 });
  const preTerrainPitchRef = useRef(0);
  const [viewResetToken, setViewResetToken] = useState(0);
  const [lensElevation, setLensElevation] = useState<number | null>(null);
  // Camera memory lives in a ref so the map-creating effect can read it
  // without re-creating the map on every moveend.
  const cameraStoreRef = useRef<CameraMemoryStore>({});

  // Hydrate persisted prefs (spec 22) + camera memory (spec 99) once.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [rawPrefs, rawCamera] = await Promise.all([
        getSetting<unknown>(MAP_V4_PREFS_KEY),
        getSetting<unknown>(CAMERA_MEMORY_KEY),
      ]);
      if (!alive) return;
      const camera = sanitizeCameraStore(rawCamera);
      cameraStoreRef.current = camera;
      setPrefs(sanitizePrefs(rawPrefs));
      setPrefsReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist layer/mode prefs whenever they change (after hydration).
  useEffect(() => {
    if (prefsReady) void setSetting(MAP_V4_PREFS_KEY, prefs);
  }, [prefs, prefsReady]);

  const mode = prefs.mode;
  const visibleIncidents = useMemo(() => {
    const inTime = filterByTimeRange(incidents, prefs.timeRange);
    const inStatus = filterByStatuses(inTime, prefs.statuses);
    // 0.3.0-dev.5 concern filter (spec 48): legacy records are wildlife_animal.
    if (prefs.concern !== "all") {
      return inStatus.filter((i) => (i.concernType ?? "wildlife_animal") === prefs.concern);
    }
    return inStatus;
  }, [incidents, prefs.timeRange, prefs.statuses, prefs.concern]);
  const availableStatuses = useMemo(
    () => statusesPresent(incidents, Object.keys(STATUS_MARKER_STYLES)),
    [incidents],
  );

  useEffect(() => {
    if (!prefsReady || !containerRef.current) return;
    setState((s) => (s === "ready" ? s : "loading"));
    const provider = createMapLibreProvider({
      serviceArea,
      fitMode,
      providerId: providerIdForMode(mode, offline),
      clustering: prefs.layers.clusters,
      showServiceArea: prefs.layers.serviceArea,
      // Spec 99: restore the persisted camera unless the view must fit the
      // service area. Never restored when nothing was persisted.
      // 0.3.0-dev.5 (spec 34/36): restore the remembered camera whenever one
      // exists — the provider only fits the service area when nothing was
      // saved. Previously fitMode="service-area" made basemap switches reset
      // the camera to the fit view, losing the user's place.
      initialCamera: cameraStoreRef.current[full ? "full" : "compact"] ?? null,
      onCameraChange: (cam) => {
        setView({ bearing: cam.bearing, pitch: cam.pitch });
        const size = full ? "full" : "compact";
        const next = { ...cameraStoreRef.current, [size]: serializeCamera(cam) };
        cameraStoreRef.current = next;
        void setSetting(CAMERA_MEMORY_KEY, next);
      },
    });
    // Bounded failure detection: if tiles haven't produced a load event within
    // 8 seconds while errors fired, classify as provider failure.
    let settled = false;
    provider.setErrorHandler((isError) => {
      if (!settled && isError) {
        if (navigator.onLine === false) setState("offline");
        else setState("provider-failed");
      }
    });
    // A successful map load is authoritative: a single transient tile error
    // must not permanently mark the provider failed when tiles do arrive.
    provider.setLoadHandler(() => {
      if (!settled) {
        settled = true;
        setState("ready");
      }
      setMapReady(true);
    });
    // Marker elements are recreated on re-render; selection flows through the
    // provider with a stable refId so clicks survive camera moves.
    // 0.3.0-dev.7: marker clicks also lift the selection to the page (list
    // sync) and never navigate away from the Map.
    provider.setSelectHandler((point) => {
      setInspected(point.refId ?? null);
      const inc = point.refId != null ? visibleIncidents[point.refId] : undefined;
      if (inc) onSelectedChange?.(inc.id);
    });
    const points = visibleIncidents
      .map((i, idx) => {
        const pos = markerPositionFor(i, effectivePrivacy(i, privacy));
        if (!pos) return null;
        return { lat: pos.lat, lon: pos.lon, state: markerStateFor(i), label: animalLabel(i), refId: idx };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Spec 92: cluster badge clicks open the inspector instead of just zooming.
    provider.setClusterHandler((c) => {
      const members = c.refs.map((refId) => points[refId]).filter((p): p is NonNullable<typeof p> => p != null);
      const summary = buildClusterSummary(members, (refId) => visibleIncidents[refId]);
      const memberPositions = members.map((m) => [m.lon, m.lat] as [number, number]);
      const west = Math.min(...memberPositions.map((p) => p[0]));
      const east = Math.max(...memberPositions.map((p) => p[0]));
      const south = Math.min(...memberPositions.map((p) => p[1]));
      const north = Math.max(...memberPositions.map((p) => p[1]));
      setCluster({ summary, bounds: [[west, south], [east, north]] });
    });

    providerRef.current = provider;
    provider.renderMarkers(containerRef.current, points);

    const readyTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState((s) => (s === "loading" ? "ready" : s));
      }
    }, offline ? 1200 : 3500);

    return () => {
      window.clearTimeout(readyTimer);
      setMapReady(false);
      provider.destroy();
      providerRef.current = null;
    };
    // cameraStoreRef is read (not subscribed) deliberately — see its comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIncidents, privacy, retryToken, serviceArea, fitMode, offline, mode, prefsReady, prefs.layers.clusters, prefs.layers.serviceArea, full, viewResetToken]);

  // ---- Terrain / 3D (spec 17/19) -------------------------------------------
  useEffect(() => {
    if (!mapReady) return;
    const map = providerRef.current?.getMap();
    if (!map) return;
    const wantTerrain = mode === "terrain" && !offline && prefs.layers.terrain;
    if (wantTerrain) {
      // 0.3.0-dev.5 (spec 29): a failed setup NO LONGER kicks the user to 2D.
      // Terrain stays selected with an honest notice + [Retry]/[Use 2D map];
      // the operator decides. Never synthesized elevation.
      const ok = enableTerrain(map, prefs.exaggeration, () => setTerrainFailed(true));
      setTerrainActive(ok);
      if (!ok) {
        setTerrainFailed(true);
        return;
      }
      setTerrainFailed(false);
      // Preserve the user's center/zoom/bearing — only tilt the camera.
      try { preTerrainPitchRef.current = map.getPitch(); } catch { /* map gone */ }
      map.easeTo({ pitch: TERRAIN_PITCH, duration: 500 });
    } else {
      disableTerrain(map);
      setTerrainFailed(false);
      // Returning to 2D restores the previous 2D pitch while keeping location.
      if (mode !== "terrain") map.easeTo({ pitch: preTerrainPitchRef.current ?? 0, duration: 400 });
    }
  }, [mapReady, mode, offline, prefs.layers.terrain, prefs.exaggeration, terrainAttempt]);

  // ---- Measure mode (spec 25): two clicks, Esc or button exits --------------
  useEffect(() => {
    if (!measureMode || !mapReady) return;
    const map = providerRef.current?.getMap();
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      setMeasurePts((pts) => (pts.length >= 2 ? pts : [...pts, [e.lngLat.lng, e.lngLat.lat] as [number, number]]));
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [measureMode, mapReady]);

  // Redraw (or clear) the measure line whenever its points change.
  useEffect(() => {
    const map = providerRef.current?.getMap();
    if (!map) return;
    setMeasureLine(map, measurePts.length === 2 ? measurePts : null);
  }, [measurePts, mapReady]);

  const exitMeasure = () => {
    setMeasureMode(false);
    setMeasurePts([]);
  };

  useEffect(() => {
    if (!measureMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitMeasure();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureMode]);

  // ---- Field lens (spec 90/23): coarse elevation in active terrain mode only
  const inspectedIncident = inspected != null ? visibleIncidents[inspected] : undefined;
  useEffect(() => {
    if (!mapReady || mode !== "terrain" || !inspectedIncident) {
      setLensElevation(null);
      return;
    }
    const map = providerRef.current?.getMap();
    if (!map) return;
    // Same privacy-respecting position the marker uses — never the raw point.
    const pos = markerPositionFor(inspectedIncident, effectivePrivacy(inspectedIncident, privacy));
    setLensElevation(pos ? queryElevationM(map, pos.lon, pos.lat) : null);
  }, [mapReady, mode, inspectedIncident, privacy]);

  // ---- Selection from the map-side list (0.3.0-dev.7 Part XII–XIV) ----------
  // The controlled selectedId prop selects + shows the incident on the map:
  // marker emphasized, camera moved with the SAME privacy-safe position the
  // marker uses, inspector opened, user stays on the Map page. The previous
  // camera is remembered once per selection so "Back to previous view" can
  // restore it (Part XIII); Reset view keeps working regardless.
  const prevCameraRef = useRef<{ zoom: number; center: { lat: number; lng: number }; bearing: number; pitch: number } | null>(null);
  const [hasPrevCamera, setHasPrevCamera] = useState(false);

  useEffect(() => {
    if (selectedId === undefined) return; // not controlled
    if (selectedId == null) {
      setInspected(null);
      prevCameraRef.current = null;
      setHasPrevCamera(false);
      return;
    }
    const idx = visibleIncidents.findIndex((i) => i.id === selectedId);
    setInspected(idx >= 0 ? idx : null);
    if (idx < 0) {
      // Selected incident was filtered out — clear gracefully (Part XV).
      onSelectedChange?.(null);
      return;
    }
    const incident = visibleIncidents[idx]!;
    const pos = markerPositionFor(incident, effectivePrivacy(incident, privacy));
    const map = mapReady ? providerRef.current?.getMap() : null;
    if (!pos || !map) return;
    // Camera target = the exact marker position (privacy-safe by construction).
    let decision: ReturnType<typeof selectionCameraDecision>;
    try {
      const b = map.getBounds();
      decision = selectionCameraDecision(pos, { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }, map.getZoom());
    } catch {
      decision = { mode: "fly", zoom: 12.5 };
    }
    if (decision.mode === "fly") {
      // Remember where the user was — once per selection chain.
      if (!prevCameraRef.current) {
        try {
          const c = map.getCenter();
          prevCameraRef.current = { zoom: map.getZoom(), center: { lat: c.lat, lng: c.lng }, bearing: map.getBearing(), pitch: map.getPitch() };
          setHasPrevCamera(true);
        } catch { /* map gone */ }
      }
      map.flyTo({ center: [pos.lon, pos.lat], zoom: decision.zoom, duration: 900, essential: true });
    } else {
      map.easeTo({ center: [pos.lon, pos.lat], duration: 500, essential: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mapReady]);

  // Selected marker emphasis: the DOM markers carry data-ref-id; toggle
  // data-selected so the marker visibly corresponds to the selected row.
  const selectedIndex = selectedId !== undefined && selectedId != null ? visibleIncidents.findIndex((i) => i.id === selectedId) : inspected;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>(".map-marker[data-ref-id]").forEach((el) => {
      el.dataset.selected = el.dataset.refId === String(selectedIndex) ? "true" : "false";
    });
  }, [selectedIndex, visibleIncidents, mapReady, state]);

  const backToPreviousView = () => {
    const map = providerRef.current?.getMap();
    const prev = prevCameraRef.current;
    if (!map || !prev) return;
    map.flyTo({ center: [prev.center.lng, prev.center.lat], zoom: prev.zoom, bearing: prev.bearing, pitch: prev.pitch, duration: 700, essential: true });
    prevCameraRef.current = null;
    setHasPrevCamera(false);
  };

  // ---- Compass + camera (spec 99/100) ---------------------------------------
  const resetCompassView = () => {
    const map = providerRef.current?.getMap();
    if (map) resetCompass(map);
  };
  const resetView = () => {
    const size = full ? "full" : "compact";
    const next = { ...cameraStoreRef.current };
    delete next[size];
    cameraStoreRef.current = next;
    void setSetting(CAMERA_MEMORY_KEY, next);
    setViewResetToken((n) => n + 1); // recreate the provider → refit the area/points
  };

  const measureKm =
    measurePts.length === 2 ? greatCircleKm(measurePts[0]![1], measurePts[0]![0], measurePts[1]![1], measurePts[1]![0]) : null;
  const measureBearing =
    measurePts.length === 2 ? bearingToCompass(initialBearingDeg(measurePts[0]![1], measurePts[0]![0], measurePts[1]![1], measurePts[1]![0])) : null;

  const setLayer = (key: keyof MapV4Prefs["layers"], value: boolean) =>
    setPrefs((p) => ({ ...p, layers: { ...p.layers, [key]: value } }));
  const toggleStatus = (status: string) =>
    setPrefs((p) => ({
      ...p,
      statuses: p.statuses.includes(status) ? p.statuses.filter((s) => s !== status) : [...p.statuses, status],
    }));


  // Zero visible incidents: say so honestly instead of showing an empty map.
  useEffect(() => {
    if (incidents.length === 0) setState("no-coordinates");
  }, [incidents.length]);

  return (
    <div style={{ position: "relative" }}>
      {!offline && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }}>
          <span>
            Map tiles from <strong>OpenStreetMap</strong> require an internet connection — the incident list works fully
            offline. Marker positions respect each incident's location privacy: approximate reports are fuzzed to ~1 km and
            sensitive reports never show a precise point.
          </span>
        </div>
      )}
      {prefs.mode === "terrain" && !offline && !terrainFailed && !terrainActive && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }} role="status" data-testid="terrain-loading">
          <span>{t("mv4TerrainLoading", { defaultValue: "Terrain — loading elevation…" })}</span>
        </div>
      )}
      {prefs.mode === "terrain" && !offline && terrainActive && !terrainFailed && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }} role="status" data-testid="terrain-active">
          <span>{t("mv4TerrainActive", { defaultValue: "Terrain active — elevation data: AWS Terrain Tiles (Terrarium). Relief: {{relief}}.", relief: prefs.exaggeration === "enhanced" ? "Enhanced" : "Natural" })}</span>
        </div>
      )}
      {terrainFailed && (
        <div className="notice warning" style={{ marginBottom: "var(--space-3)" }} role="status" data-testid="terrain-unavailable">
          <span>{t("mv4TerrainError", { defaultValue: "Terrain unavailable — elevation couldn't load. Terrain 3D needs an internet connection and WebGL." })}</span>
          <button
            className="btn btn-secondary btn-sm"
            data-testid="terrain-retry"
            onClick={() => {
              setTerrainFailed(false);
              setPrefs((p) => ({ ...p, mode: "terrain" }));
              setTerrainAttempt((n) => n + 1);
            }}
          >
            {t("mv4TerrainRetry", { defaultValue: "Retry" })}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => setPrefs((p) => ({ ...p, mode: "2d" }))}>
            {t("mv4TerrainUseStreets", { defaultValue: "Use 2D map" })}
          </button>
        </div>
      )}
      {offline && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }} role="status">
          <span>
            {t("offlineBasemapNote", {
              defaultValue: "Offline basemap — the map is drawn entirely on this device and no tile requests are made. Markers respect each incident's location privacy.",
            })}
          </span>
        </div>
      )}
      {(state === "offline" || state === "provider-failed") && (
        <div className="notice warning" style={{ marginBottom: "var(--space-3)" }} role="status">
          <div>
            <strong>
              {state === "offline"
                ? t("mapOfflineState", { defaultValue: "Internet unavailable — showing an offline position view instead." })
                : t("mapFailedState", { defaultValue: "Map temporarily unavailable — the tile provider is unreachable, blocked, or rate-limited." })}
            </strong>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRetryToken((n) => n + 1)}>Retry map</button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
              {t("mapFallbackCoordsNote", { defaultValue: "Coordinates below are shown as stored (subject to each incident's location privacy)." })}
            </p>
          </div>
        </div>
      )}
      {state === "no-coordinates" && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }} role="status">
          <span>{t("noCoordinatesState", { defaultValue: "Map is available, but no incident on this device has a mappable location yet." })}</span>
        </div>
      )}
      {(state === "offline" || state === "provider-failed") ? (
        <div
          className="offline-position-view"
          style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "auto", background: "var(--c-surface-alt)", maxHeight: compact ? 280 : 460 }}
          role="region"
          aria-label={t("fallbackRegion", { defaultValue: "Location list (map unavailable)" })}
        >
          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong>{t("fallbackTitle", { defaultValue: "Map temporarily unavailable" })}</strong>
            <button className="btn btn-secondary btn-sm" onClick={() => setRetryToken((n) => n + 1)}>
              <Icons.refresh size={14} /> {t("retryMap", { defaultValue: "Retry" })}
            </button>
            {getMapDiagnostics().lastErrorMessage && (
              <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{getMapDiagnostics().lastErrorMessage}</span>
            )}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {incidents.map((i) => {
              const pos = markerPositionFor(i, effectivePrivacy(i, privacy));
              const isSensitive = i.location.precision === "sensitive";
              return (
                <li key={i.id} style={{ padding: "10px var(--space-4)", borderTop: "1px solid var(--c-border)" }}>
                  <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span
                      className="map-marker offline"
                      data-state={markerStateFor(i)}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 1px 4px rgb(0 0 0 / 0.4)", color: "#fff", fontSize: 11, fontWeight: 700, background: STATUS_MARKER_STYLES[markerStateFor(i)]?.color ?? "#2563eb" }}
                      aria-hidden="true"
                    >
                      {STATUS_MARKER_STYLES[markerStateFor(i)]?.glyph ?? "●"}
                    </span>
                    <Link to={`/incidents/${i.id}`} style={{ fontWeight: 600 }}>{animalLabel(i)}</Link>
                    <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{i.humanReference}</span>
                    <span className="badge">{isSensitive ? t("privacySensitive", { defaultValue: "Sensitive — area only" }) : t("privacyApprox", { defaultValue: "Approximate" })}</span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--c-ink-soft)", marginTop: 2 }}>
                    {pos ? (
                      <code>{pos.lat.toFixed(2)}°, {pos.lon.toFixed(2)}°</code>
                    ) : (
                      t("noMappableLocation", { defaultValue: "No mappable location" })
                    )}
                    {i.location.description ? ` · ${i.location.description}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Spec 17 — mode control: 2D / Satellite / Terrain 3D. Terrain and
              satellite honestly require the internet; offline keeps only 2D. */}
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 20 }}>
            <div className="segmented" role="group" aria-label={t("mv4ModeLabel", { defaultValue: "Map mode" })} style={{ boxShadow: "var(--shadow-sm)" }}>
              <button aria-pressed={mode === "2d"} onClick={() => setPrefs((p) => ({ ...p, mode: "2d" }))}>
                {t("basemapStreets", { defaultValue: "2D" })}
              </button>
              <button aria-pressed={mode === "satellite"} disabled={offline} title={offline ? t("mv4OfflineModes", { defaultValue: "Satellite imagery needs an internet connection." }) : undefined} onClick={() => setPrefs((p) => ({ ...p, mode: "satellite" }))}>
                {t("basemapSatellite", { defaultValue: "Satellite" })}
              </button>
              <button aria-pressed={mode === "terrain"} disabled={offline} title={offline ? t("mv4OfflineModes", { defaultValue: "Terrain needs an internet connection and WebGL." }) : undefined} onClick={() => setPrefs((p) => ({ ...p, mode: "terrain" }))}>
                {t("mv4ModeTerrain", { defaultValue: "Terrain 3D" })}
              </button>
            </div>
          </div>
          {/* Spec 22/25/99/100 — right-hand control column. */}
          <div className="mv4-controls" style={{ position: "absolute", top: 10, right: 10, zIndex: 20, display: "grid", gap: 6, justifyItems: "stretch" }}>
            <button className="btn btn-quiet btn-sm mv4-ctl" aria-expanded={layerPanelOpen} onClick={() => setLayerPanelOpen((v) => !v)}>
              <Icons.map size={14} /> {t("mv4Layers", { defaultValue: "Layers" })}
            </button>
            <button className="btn btn-quiet btn-sm mv4-ctl" aria-pressed={measureMode} onClick={() => (measureMode ? exitMeasure() : (setMeasureMode(true), setMeasurePts([])))}>
              <Icons.pin size={14} /> {t("mv4Measure", { defaultValue: "Measure" })}
            </button>
            <button className="btn btn-quiet btn-sm mv4-ctl" onClick={resetCompassView} aria-label={t("mv4Compass", { defaultValue: "Reset north" })} title={t("mv4Compass", { defaultValue: "Reset north" })}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={{ display: "inline-block", transform: `rotate(${-view.bearing}deg)` }}>
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <path d="M8 2 L10 8 L8 7 L6 8 Z" fill="#ef4444" />
                <path d="M8 14 L6 8 L8 9 L10 8 Z" fill="currentColor" opacity="0.8" />
              </svg>
              {t("mv4CompassShort", { defaultValue: "N" })}
            </button>
            {mode === "terrain" && (
              <button
                className="btn btn-quiet btn-sm mv4-ctl"
                aria-pressed={(view.pitch ?? 0) > 5}
                onClick={() => {
                  const map = providerRef.current?.getMap();
                  if (!map) return;
                  easePitch(map, (view.pitch ?? 0) > 5 ? 0 : TERRAIN_PITCH);
                }}
                title={t("mv4Tilt", { defaultValue: "3D tilt on / off" })}
              >
                {t("mv4Tilt", { defaultValue: "3D tilt on / off" })}
              </button>
            )}
            <button className="btn btn-quiet btn-sm mv4-ctl" onClick={resetView} aria-label={t("mv4ResetView", { defaultValue: "Reset view" })} title={t("mv4ResetView", { defaultValue: "Reset view" })}>
              <Icons.refresh size={14} /> {t("mv4ResetView", { defaultValue: "Reset view" })}
            </button>
            {hasPrevCamera && (
              <button className="btn btn-quiet btn-sm mv4-ctl" onClick={backToPreviousView} aria-label={t("mv4PrevView", { defaultValue: "Back to previous view" })} title={t("mv4PrevView", { defaultValue: "Back to previous view" })}>
                <Icons.undo size={14} /> {t("mv4PrevView", { defaultValue: "Back to previous view" })}
              </button>
            )}
          </div>
          {layerPanelOpen && (
            <aside className="card mv4-panel" aria-label={t("mv4Layers", { defaultValue: "Layers" })} style={{ position: "absolute", top: 118, right: 10, width: 240, maxWidth: "calc(100% - 20px)", zIndex: 25, padding: "var(--space-3)", boxShadow: "var(--shadow-lg)", display: "grid", gap: 10 }}>
              <label className="mv4-row">
                <input type="checkbox" checked={prefs.layers.incidents} onChange={(e) => setLayer("incidents", e.target.checked)} />
                {t("mv4LayerIncidents", { defaultValue: "Incidents" })}
              </label>
              <label className="mv4-row">
                <input type="checkbox" checked={prefs.layers.clusters} onChange={(e) => setLayer("clusters", e.target.checked)} />
                {t("mv4LayerClusters", { defaultValue: "Clusters" })}
              </label>
              {serviceArea && (
                <label className="mv4-row">
                  <input type="checkbox" checked={prefs.layers.serviceArea} onChange={(e) => setLayer("serviceArea", e.target.checked)} />
                  {t("mv4LayerServiceArea", { defaultValue: "Service area" })}
                </label>
              )}
              {mode === "terrain" && (
                <label className="mv4-row">
                  <input type="checkbox" checked={prefs.layers.terrain} onChange={(e) => setLayer("terrain", e.target.checked)} />
                  {t("mv4LayerTerrain", { defaultValue: "Terrain / hillshade" })}
                </label>
              )}
              <div className="mv4-group">
                <span className="mv4-label">{t("mv4TimeFilter", { defaultValue: "Time" })}</span>
                <div className="segmented" role="group" aria-label={t("mv4TimeFilter", { defaultValue: "Time filter" })}>
                  {([["24h", "24 h"], ["7d", "7 d"], ["30d", "30 d"], ["all", t("mv4TimeAll", { defaultValue: "All" })]] as const).map(([r, label]) => (
                    <button key={r} aria-pressed={prefs.timeRange === r} onClick={() => setPrefs((p) => ({ ...p, timeRange: r }))}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="mv4-group">
                <span className="mv4-label">{t("mv4ConcernFilter", { defaultValue: "Concern type" })}</span>
                <select
                  className="input"
                  aria-label={t("mv4ConcernFilter", { defaultValue: "Concern type" })}
                  value={prefs.concern}
                  onChange={(e) => setPrefs((p) => ({ ...p, concern: e.target.value }))}
                >
                  <option value="all">{t("mv4ConcernAll", { defaultValue: "All concerns" })}</option>
                  {CONCERN_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="mv4-group">
                <span className="mv4-label">{t("mv4StatusFilter", { defaultValue: "Statuses" })}</span>
                <div className="mv4-chips" role="group" aria-label={t("mv4StatusFilter", { defaultValue: "Status filter" })}>
                  {availableStatuses.map((s) => (
                    <button key={s} className="mv4-chip" aria-pressed={prefs.statuses.includes(s)} onClick={() => toggleStatus(s)}>
                      <span aria-hidden="true" style={{ color: STATUS_MARKER_STYLES[s]?.color }}>{STATUS_MARKER_STYLES[s]?.glyph ?? "●"}</span>
                      {STATUS_MARKER_STYLES[s]?.label ?? s}
                    </button>
                  ))}
                </div>
              </div>
              {mode === "terrain" && (
                <div className="mv4-group">
                  <span className="mv4-label">{t("mv4Exaggeration", { defaultValue: "Terrain exaggeration" })}</span>
                  <div className="segmented" role="group" aria-label={t("mv4Exaggeration", { defaultValue: "Terrain exaggeration" })}>
                    <button aria-pressed={prefs.exaggeration === "natural"} onClick={() => setPrefs((p) => ({ ...p, exaggeration: "natural" }))}>{t("mv4ExagNatural", { defaultValue: "Natural" })}</button>
                    <button aria-pressed={prefs.exaggeration === "enhanced"} onClick={() => setPrefs((p) => ({ ...p, exaggeration: "enhanced" }))}>{t("mv4ExagEnhanced", { defaultValue: "Enhanced" })}</button>
                  </div>
                </div>
              )}
            </aside>
          )}
          {measureMode && (
            <div className="card mv4-measure" role="status" style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 25, padding: "6px var(--space-3)", boxShadow: "var(--shadow-lg)", display: "flex", gap: 10, alignItems: "center", maxWidth: "calc(100% - 20px)" }}>
              <span style={{ fontSize: "0.82rem" }}>
                {measureKm != null
                  ? t("mv4MeasureResult", {
                      defaultValue: "Distance {{distance}} · Bearing {{bearing}}",
                      distance: formatDistance(measureKm, units),
                      bearing: measureBearing,
                    })
                  : t("mv4MeasureHint", { defaultValue: "Click two points on the map to measure the distance. Esc exits." })}
              </span>
              <button className="btn btn-quiet btn-sm" onClick={exitMeasure} aria-label={t("mv4MeasureExit", { defaultValue: "Exit measure mode" })}>
                <Icons.x size={14} />
              </button>
            </div>
          )}
          {cluster && (
            <aside className="card mv4-panel" aria-label={t("mv4ClusterTitle", { defaultValue: "Cluster" })} style={{ position: "absolute", bottom: 12, left: 10, width: 250, maxWidth: "calc(100% - 20px)", zIndex: 25, padding: "var(--space-3)", boxShadow: "var(--shadow-lg)", display: "grid", gap: 6 }}>
              <div className="row between" style={{ gap: 8 }}>
                <strong style={{ fontSize: "0.9rem" }}>{t("mv4ClusterTitle", { defaultValue: "Cluster" })}</strong>
                <button className="btn btn-quiet btn-sm" aria-label={t("inspectorClose", { defaultValue: "Close" })} onClick={() => setCluster(null)}>
                  <Icons.x size={14} />
                </button>
              </div>
              <span style={{ fontSize: "0.85rem" }}>
                {t("mv4ClusterCases", { defaultValue: "{{count}} incidents", count: cluster.summary.count })}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--c-ink-soft)" }}>
                {Object.entries(cluster.summary.states)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, n]) => `${STATUS_MARKER_STYLES[s]?.label ?? s}: ${n}`)
                  .join(" · ")}
              </span>
              {cluster.summary.oldestReference && (
                <span style={{ fontSize: "0.78rem", color: "var(--c-ink-soft)" }}>
                  {t("mv4ClusterOldest", { defaultValue: "Oldest case" })}: <bdi>{cluster.summary.oldestReference}</bdi>
                </span>
              )}
              <span style={{ fontSize: "0.78rem", color: "var(--c-ink-soft)" }}>
                {t("mv4ClusterUnassigned", { defaultValue: "Unassigned" })}: {cluster.summary.unassigned}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const map = providerRef.current?.getMap();
                  if (map) map.fitBounds(cluster.bounds, { padding: 60, maxZoom: 14, duration: 400 });
                  setCluster(null);
                }}
              >
                {t("mv4ClusterInspect", { defaultValue: "Inspect cluster" })}
              </button>
            </aside>
          )}
          <div
            ref={containerRef}
            style={{
              height: heightFor(full ? "full" : compact ? "compact" : "standard"),
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--c-border)",
              overflow: "hidden",
              position: "relative",
            }}
          />
          {/* 0.3.0-dev.6 (Part III/XVII) — inspector V6: header + structured
              location + collapsed technical details + action area. Close sits
              top-right with a 28px hit target; Escape closes. */}
          {inspectedIncident && (
            <aside
              className="card map-inspector"
              aria-label={t("inspectorLabel", { defaultValue: "Incident details" })}
              style={{
                position: "absolute", top: 12, right: 12, width: 300, minWidth: 264, maxWidth: "calc(100% - 24px)",
                zIndex: 30, padding: "var(--space-3)", boxShadow: "var(--shadow-lg)", display: "grid", gap: 6,
              }}
              onKeyDown={(e) => { if (e.key === "Escape") { setInspected(null); onSelectedChange?.(null); } }}
            >
              <button
                className="btn btn-quiet btn-sm"
                style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, padding: 0, justifyContent: "center", zIndex: 2 }}
                title={t("inspectorClose", { defaultValue: "Close" })}
                aria-label={t("inspectorClose", { defaultValue: "Close" })}
                onClick={() => { setInspected(null); onSelectedChange?.(null); }}
              >
                <Icons.x size={14} />
              </button>
              <strong style={{ fontSize: "0.95rem", overflowWrap: "anywhere", paddingRight: 30 }}>{animalLabel(inspectedIncident)}</strong>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <StatusBadge status={inspectedIncident.status} />
                <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)", fontVariantNumeric: "tabular-nums" }}>
                  {inspectedIncident.humanReference} · {t("reportedAgo", { defaultValue: "Reported" })} {relativeTime(inspectedIncident.occurredAt ?? inspectedIncident.createdAt)}
                </span>
              </div>
              <LocationIntel incident={inspectedIncident} serviceArea={serviceArea} />
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-ink-soft)" }}>
                {inspectedIncident.custody.some((c) => !c.endedAt) && inspectedIncident.status !== "reported" && inspectedIncident.status !== "response_requested"
                  ? inspectedIncident.custody.find((c) => !c.endedAt)?.holder
                  : t("colUnassigned", { defaultValue: "Unassigned" })}
              </p>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <Link className="btn btn-primary btn-sm" to={`/incidents/${inspectedIncident.id}`} onClick={() => onSelect?.(inspectedIncident)}>
                  {t("openIncident", { defaultValue: "Open incident" })}
                </Link>
                <BookmarkButton incident={inspectedIncident} />
                <button
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    const pos = markerPositionFor(inspectedIncident, effectivePrivacy(inspectedIncident, privacy));
                    if (pos) {
                      setMeasureMode(true);
                      setMeasurePts([[pos.lon, pos.lat]]);
                      setInspected(null);
                    }
                  }}
                >
                  <Icons.pin size={13} /> {t("mv4MeasureFrom", { defaultValue: "Measure from here" })}
                </button>
              </div>
              {/* Field lens (spec 90/23): terrain mode only, coarse "≈" elevation,
                  built through buildFieldLens so no coordinates can leak. */}
              {(() => {
                const lens = buildFieldLens(inspectedIncident, lensElevation);
                if (lens.elevationM == null) return null;
                return (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-ink-soft)" }}>
                    {t("mv4LensElevation", { defaultValue: "Elevation" })} {formatElevation(lens.elevationM)}
                    <span className="hint" style={{ display: "block", margin: 0, fontSize: "0.68rem" }}>
                      {t("mv4DemNote", { defaultValue: "Elevation: AWS Terrain Tiles (~30 m resolution)" })}
                    </span>
                  </p>
                );
              })()}
            </aside>
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: "var(--space-2)", gap: 10, fontSize: "0.78rem", color: "var(--c-ink-soft)", flexWrap: "wrap" }}>
        {Object.entries(STATUS_MARKER_STYLES).map(([status, st]) => (
          <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              aria-hidden="true"
              style={{ width: 14, height: 14, borderRadius: "50%", background: st.color, border: "1.6px solid #fff", boxShadow: "0 0 3px rgb(0 0 0 / 0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 8.5, fontWeight: 700 }}
            >
              {st.glyph}
            </span>
            {st.label}
          </span>
        ))}
      </div>
    </div>
  );
}


/** Initial great-circle bearing A->B in degrees (0 = north). */
function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Convert degrees bearing to a compass direction. */
function bearingToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8] ?? "N";
}

/**
 * Location intelligence for the map inspector — dev.18 privacy-hardened:
 *  - operational info first (description, landmark, distance/bearing,
 *    accuracy); raw coordinates demoted to a collapsed "Technical details"
 *    section, shown at the incident's own precision (generalized for
 *    approximate, hidden for sensitive);
 *  - SENSITIVE: reverse-geocode is disabled — nothing is ever sent;
 *  - APPROXIMATE: only the ~1 km generalized coordinate is ever sent;
 *  - EXACT: first lookup asks for consent (Continue/Cancel + remember);
 *  - results cached persistently, rate-limited, honest failure messages.
 */
function LocationIntel({ incident, serviceArea }: { incident: Incident; serviceArea: MapServiceArea | null }) {
  const { t } = useTranslation("professional");
  const { latitude, longitude, precision } = incident.location;
  const [intel, setIntel] = useState<{ road?: string; city?: string } | null>(() => {
    if (latitude == null || longitude == null) return null;
    const dec = resolveGeocodeTarget(precision ?? undefined, latitude, longitude, "allowed");
    if (dec.kind !== "ready") return null;
    const hit = peekGeocodeCache(dec.target.lat, dec.target.lon);
    return hit ? { road: hit.road, city: hit.city } : null;
  });
  const [state, setState] = useState<"idle" | "loading" | "ok" | "blocked" | "consent" | "rate_limited" | "no_result" | "failed">(() => {
    if (precision === "sensitive") return "blocked";
    return "idle";
  });
  const [consentTarget, setConsentTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [rememberConsent, setRememberConsent] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const provider = getActiveGeocodingProvider();

  useEffect(() => {
    setIntel(null);
    setConsentTarget(null);
    setState(precision === "sensitive" ? "blocked" : "idle");
  }, [latitude, longitude, precision]);

  const displayPos =
    latitude == null || longitude == null
      ? null
      : precision === "sensitive"
        ? null
        : precision === "approximate"
          ? fuzzCoordinates(latitude, longitude)
          : { lat: latitude, lon: longitude };

  const load = async (consented?: boolean) => {
    if (latitude == null || longitude == null) return;
    const consent = consented ? "allowed" : getExactGeocodeConsent();
    const decision = resolveGeocodeTarget(precision ?? undefined, latitude, longitude, consent);
    if (decision.kind === "blocked") { setState("blocked"); return; }
    if (decision.kind === "consent_required") { setConsentTarget(decision.target); setState("consent"); return; }
    setConsentTarget(null);
    setState("loading");
    const outcome = await reverseGeocode(decision);
    if (outcome.kind === "ok") { setIntel({ road: outcome.result.road, city: outcome.result.city }); setState("ok"); }
    else if (outcome.kind === "no_result") setState("no_result");
    else if (outcome.kind === "rate_limited") setState("rate_limited");
    else setState("failed");
  };

  const acceptConsent = () => {
    if (rememberConsent) setExactGeocodeConsent("allowed");
    setRememberConsent(false);
    void load(true);
  };

  let distanceBearing: string | null = null;
  if (serviceArea?.centerLat != null && serviceArea.centerLon != null && latitude != null && longitude != null) {
    const dLat = (latitude - serviceArea.centerLat) * 110.574;
    const dLon = (longitude - serviceArea.centerLon) * 111.32 * Math.cos((serviceArea.centerLat * Math.PI) / 180);
    const dist = Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 10) / 10;
    const bearing = (Math.atan2(longitude - serviceArea.centerLon, latitude - serviceArea.centerLat) * 180) / Math.PI;
    distanceBearing = dist + " km " + bearingToCompass(bearing) + " of " + (serviceArea.label ?? "center");
  }

  if (latitude == null || longitude == null) {
    return (
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-warn)" }}>
        {t("intelNoCoordinates", { defaultValue: "No coordinates recorded — ask the reporter for a location pin." })}
      </p>
    );
  }

  return (
    <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 6, display: "grid", gap: 4, fontSize: "0.8rem" }}>
      <strong style={{ fontSize: "0.72rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-ink-faint)" }}>
        {t("intelTitle", { defaultValue: "Location" })}
      </strong>
      {incident.location.description && (
        <span className="intel-row"><Icons.pin size={13} /> <span>{incident.location.description}</span></span>
      )}
      {incident.location.landmark && (
        <span className="intel-row"><Icons.compass size={13} /> <span>{t("intelNearLandmark", { defaultValue: "near" })} {incident.location.landmark}</span></span>
      )}
      {incident.location.address && (
        <span className="intel-row"><Icons.home size={13} /> <span>{incident.location.address}</span></span>
      )}
      {distanceBearing && (
        <span className="intel-row"><Icons.map size={13} /> <span>{distanceBearing}</span></span>
      )}
      {incident.location.accuracyMeters != null && (
        <span className="intel-row">
          <Icons.crosshair size={13} />
          <span>
            <span className="intel-k">{t("intelAccuracy", { defaultValue: "GPS accuracy" })}</span>
            ±{incident.location.accuracyMeters} m
          </span>
        </span>
      )}

      {state === "blocked" && (
        <span className="hint" style={{ margin: 0 }}>
          {t("intelBlockedSensitive", { defaultValue: "Nearest-place lookup is disabled for sensitive locations — nothing is sent to third parties." })}
        </span>
      )}

      {state === "consent" && consentTarget && (
        <div role="dialog" aria-label={t("intelConsentTitle", { defaultValue: "Send this location?" })} style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 8, display: "grid", gap: 6 }}>
          <span>
            {t("intelConsentBody", {
              defaultValue: "Looking up a nearby road/place will send this location to {{provider}}.",
              provider: provider.displayName,
              interpolation: { escapeValue: false },
            })}
          </span>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.75rem" }}>
            <input type="checkbox" checked={rememberConsent} onChange={(e) => setRememberConsent(e.target.checked)} />
            {t("intelConsentRemember", { defaultValue: "Remember this preference" })}
          </label>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={acceptConsent}>{t("intelConsentContinue", { defaultValue: "Continue" })}</button>
            <button className="btn btn-quiet btn-sm" onClick={() => { setConsentTarget(null); setState("idle"); }}>{t("intelConsentCancel", { defaultValue: "Cancel" })}</button>
          </div>
        </div>
      )}

      {state === "idle" && (
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: "start" }} onClick={() => void load()}>
          {t("intelLookup", { defaultValue: "Look up nearest road/place" })}
        </button>
      )}
      {state === "loading" && <span className="hint" style={{ margin: 0 }}>{t("intelLoading", { defaultValue: "Looking up…" })}</span>}
      {state === "ok" && intel && (
        <span>
          {intel.road && (
            <span className="intel-row" style={{ display: "flex" }}>
              <Icons.map size={13} />
              <span>
                <span className="intel-k">{t("intelNearestPlace", { defaultValue: "Nearest place" })}</span>
                {intel.road}{intel.road && intel.city ? " · " : ""}{intel.city}
              </span>
            </span>
          )}
          {intel.road && intel.city ? " · " : ""}
          {intel.city}
          <span className="hint" style={{ display: "block", margin: 0, fontSize: "0.68rem" }}>{provider.attribution}</span>
        </span>
      )}
      {state === "no_result" && (
        <span className="hint" style={{ margin: 0 }}>{t("intelNoResult", { defaultValue: "Nearest named place unavailable. Stored incident location remains unchanged." })}</span>
      )}
      {state === "rate_limited" && (
        <span className="hint" style={{ margin: 0 }}>{t("intelRateLimited", { defaultValue: "Lookup service is busy (rate limit). Try again in a minute." })}</span>
      )}
      {state === "failed" && (
        <span className="hint" style={{ margin: 0, color: "var(--c-warn)" }}>{t("intelFailed", { defaultValue: "Nearest named place unavailable (offline or service down). Stored incident location remains unchanged." })}</span>
      )}

      {/* Technical details — raw coordinates only for exact incidents. */}
      <button
        className="btn btn-quiet btn-sm"
        style={{ alignSelf: "start", padding: "2px 6px" }}
        aria-expanded={showTech}
        onClick={() => setShowTech((v) => !v)}
      >
        {t("intelTechDetails", { defaultValue: "Technical details" })}
      </button>
      {showTech && (
        <span style={{ color: "var(--c-ink-faint)" }}>
          {displayPos ? (
            <code>{displayPos.lat.toFixed(5)}, {displayPos.lon.toFixed(5)}</code>
          ) : (
            t("intelCoordsHidden", { defaultValue: "Exact coordinates hidden for this privacy level." })
          )}
          {precision === "approximate" && (
            <span className="hint" style={{ display: "block", margin: 0, fontSize: "0.68rem" }}>
              {t("intelGeneralizedNote", { defaultValue: "Generalized ~1 km — the stored exact coordinate is never shown or sent." })}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
