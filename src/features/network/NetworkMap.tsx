/** React wrapper for the MapLibre provider (network map + dashboard panel). */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Incident } from "../../types/incident";
import { createMapLibreProvider, markerPositionFor, markerStateFor, STATUS_MARKER_COLORS, getMapDiagnostics, type MapPrivacy, type MapServiceArea } from "./mapProvider";
import { animalLabel } from "../export/exportService";
import { Icons } from "../../components/Icons";
import { StatusBadge } from "../../components/ui";
import { relativeTime } from "../../utils/time";

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
}) {
  const { t } = useTranslation("professional");
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>(() => (incidents.length === 0 ? "no-coordinates" : "loading"));
  const [retryToken, setRetryToken] = useState(0);
  const [inspected, setInspected] = useState<number | null>(null);
  const [basemap, setBasemap] = useState<"satellite" | "streets">("satellite");
  const providerRef = useRef<ReturnType<typeof createMapLibreProvider> | null>(null);

  useEffect(() => {
    if (incidents.length === 0) {
      setState("no-coordinates");
      return;
    }
    if (!containerRef.current) return;
    setState((s) => (s === "ready" ? s : "loading"));
    const provider = createMapLibreProvider({
      serviceArea,
      fitMode,
      providerId: offline ? "offline-basemap" : basemap === "streets" ? "osm-raster" : "esri-satellite",
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
    });
    // Marker elements are recreated on re-render; selection flows through the
    // provider with a stable refId so clicks survive camera moves.
    provider.setSelectHandler((point) => {
      setInspected(point.refId ?? null);
    });
    providerRef.current = provider;

    const points = incidents
      .map((i, idx) => {
        const pos = markerPositionFor(i, privacy);
        if (!pos) return null;
        return { lat: pos.lat, lon: pos.lon, state: markerStateFor(i), label: animalLabel(i), refId: idx };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    provider.renderMarkers(containerRef.current, points);

    const readyTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState((s) => (s === "loading" ? "ready" : s));
      }
    }, offline ? 1200 : 3500);

    return () => {
      window.clearTimeout(readyTimer);
      provider.destroy();
      providerRef.current = null;
    };
  }, [incidents, privacy, retryToken, serviceArea, fitMode, offline, basemap]);

  const inspectedIncident = inspected != null ? incidents[inspected] : undefined;

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
              const pos = markerPositionFor(i, privacy);
              const isSensitive = i.location.precision === "sensitive";
              return (
                <li key={i.id} style={{ padding: "10px var(--space-4)", borderTop: "1px solid var(--c-border)" }}>
                  <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className={`map-marker offline`} data-state={markerStateFor(i)} aria-hidden="true">
                      <span className="map-marker-shape">●</span>
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
          {!offline && (
            <div style={{ position: "absolute", top: 10, left: 10, zIndex: 20 }}>
              <div className="segmented" role="group" aria-label={t("basemapToggle", { defaultValue: "Basemap" })} style={{ boxShadow: "var(--shadow-sm)" }}>
                <button aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>{t("basemapSatellite", { defaultValue: "Satellite" })}</button>
                <button aria-pressed={basemap === "streets"} onClick={() => setBasemap("streets")}>{t("basemapStreets", { defaultValue: "Streets" })}</button>
              </div>
            </div>
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
          {/* P19 — lightweight map inspector (not a modal). */}
          {inspectedIncident && (
            <aside
              className="card map-inspector"
              aria-label={t("inspectorLabel", { defaultValue: "Incident details" })}
              style={{
                position: "absolute", top: 12, right: 12, width: 264, maxWidth: "calc(100% - 24px)",
                zIndex: 30, padding: "var(--space-3)", boxShadow: "var(--shadow-lg)", display: "grid", gap: 6,
              }}
            >
              <div className="row between" style={{ gap: 8 }}>
                <strong style={{ fontSize: "0.95rem" }}>{animalLabel(inspectedIncident)}</strong>
                <button className="btn btn-quiet btn-sm" aria-label={t("inspectorClose", { defaultValue: "Close" })} onClick={() => setInspected(null)}>
                  <Icons.x size={14} />
                </button>
              </div>
              <StatusBadge status={inspectedIncident.status} />
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
                {inspectedIncident.humanReference} · {t("reportedAgo", { defaultValue: "Reported" })} {relativeTime(inspectedIncident.occurredAt ?? inspectedIncident.createdAt)}
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
                {inspectedIncident.location.precision === "sensitive"
                  ? t("privacySensitive", { defaultValue: "Sensitive — area only" })
                  : t("privacyApprox", { defaultValue: "Approximate location" })}
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
                {inspectedIncident.custody.some((c) => !c.endedAt) && inspectedIncident.status !== "reported" && inspectedIncident.status !== "response_requested"
                  ? inspectedIncident.custody.find((c) => !c.endedAt)?.holder
                  : t("colUnassigned", { defaultValue: "Unassigned" })}
              </p>
              <Link className="btn btn-primary btn-sm" to={`/incidents/${inspectedIncident.id}`} onClick={() => onSelect?.(inspectedIncident)}>
                {t("openIncident", { defaultValue: "Open incident" })}
              </Link>
            </aside>
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: "var(--space-2)", gap: 12, fontSize: "0.82rem", color: "var(--c-ink-soft)", flexWrap: "wrap" }}>
        {Object.entries(STATUS_MARKER_COLORS).map(([state, color]) => (
          <span key={state} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className={`map-marker-legend`} data-state={state} style={{ background: color }} />
            {state === "new" ? t("legendNew", { defaultValue: "New / reported" }) : state === "active" ? t("legendActive", { defaultValue: "Assigned / responding" }) : state === "transfer" ? t("legendTransfer", { defaultValue: "Transfer / in care" }) : t("legendClosed", { defaultValue: "Closed" })}
          </span>
        ))}
      </div>
    </div>
  );
}
